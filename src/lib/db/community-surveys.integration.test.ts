import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as s from "../../../drizzle/schema";
import { loadMigrations, runMigrations } from "../../../scripts/db/migrations.mjs";

// Disposable databases only; initialize through the authoritative deployment runner.
const url = process.env.MIGRATION_TEST_DATABASE_URL;
describe.skipIf(!url)("community survey SQL integrity", () => {
  let admin: ReturnType<typeof postgres>, sql: ReturnType<typeof postgres>;
  const database = `survey_test_${randomUUID().replaceAll("-", "")}`;
  const project = randomUUID(),
    creator = randomUUID(),
    respondent = randomUUID();
  beforeAll(async () => {
    admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin`create database ${admin(database)}`;
    const target = new URL(url!);
    target.pathname = `/${database}`;
    sql = postgres(target.href, { max: 6, onnotice: () => {} });
    // Exercise revocations even on hosts that grant browser roles default access.
    for (const role of ["anon", "authenticated"]) {
      await admin.unsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role}; END IF; END $$`,
      );
      await sql.unsafe(`ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO ${role}`);
    }
    await runMigrations(sql, await loadMigrations());
    await sql`insert into projects(id, name) values (${project}, 'Synthetic survey project')`;
    await sql`insert into app_users(id, email) values (${creator}, ${`${creator}@example.test`}), (${respondent}, ${`${respondent}@example.test`})`;
  });
  afterAll(async () => {
    if (sql) await sql.end();
    if (admin) {
      await admin`drop database if exists ${admin(database)} with (force)`;
      await admin.end();
    }
  });
  async function survey(count = 2) {
    const id = randomUUID(),
      options = Array.from({ length: count }, () => randomUUID());
    await sql.begin(async (tx) => {
      await tx`insert into community_surveys(id, project_id, created_by, question) values (${id}, ${project}, ${creator}, 'Choose one')`;
      for (let i = 0; i < count; i++)
        await tx`insert into community_survey_options(id, survey_id, label, position) values (${options[i]}, ${id}, ${`Option ${i + 1}`}, ${i + 1})`;
    });
    return { id, options };
  }
  const publish = (id: string) =>
    sql`update community_surveys set state = 'published', published_at = clock_timestamp() where id = ${id}`;
  const close = (id: string) =>
    sql`update community_surveys set state = 'closed', closed_at = clock_timestamp() where id = ${id}`;
  const vote = (id: string, option: string, user = respondent) =>
    sql`insert into community_survey_responses(survey_id, option_id, user_id) values (${id}, ${option}, ${user})`;
  const failure = async (op: PromiseLike<unknown>, code = "23514") => {
    await expect(op).rejects.toMatchObject({ code });
  };

  it("commits 2/6 options, rejects 0/1 at commit and 7 by position; rolls back parents", async () => {
    await survey(2);
    await survey(6);
    for (const n of [0, 1, 7]) await failure(survey(n));
    expect((await sql`select count(*)::int n from community_surveys`)[0].n).toBe(2);
    const db = drizzle(sql);
    const f = await survey();
    expect(
      (await db.select().from(s.communitySurveys).where(eq(s.communitySurveys.id, f.id)))[0].state,
    ).toBe("draft");
  });
  it("checks text, positions, state and lifecycle timestamps", async () => {
    const f = await survey();
    for (const question of ["", " \t\n", "x".repeat(501)])
      await failure(sql`update community_surveys set question = ${question} where id = ${f.id}`);
    for (const label of ["", " \t\n", "x".repeat(201)])
      await failure(
        sql`update community_survey_options set label = ${label} where id = ${f.options[0]}`,
      );
    for (const position of [0, 7])
      await failure(
        sql`update community_survey_options set position = ${position} where id = ${f.options[0]}`,
      );
    await failure(
      sql`update community_survey_options set position = 2 where id = ${f.options[0]}`,
      "23505",
    );
    for (const state of ["invalid", "closed", "published"])
      await failure(sql`update community_surveys set state = ${state} where id = ${f.id}`);
    await failure(sql`update community_surveys set published_at = now() where id = ${f.id}`);
    await failure(
      sql`update community_surveys set state = 'published', published_at = created_at - interval '1 second' where id = ${f.id}`,
    );
    await publish(f.id);
    await failure(sql`update community_surveys set closed_at = now() where id = ${f.id}`);
    await failure(
      sql`update community_surveys set state = 'closed', closed_at = published_at - interval '1 second' where id = ${f.id}`,
    );
    await close(f.id);
    await failure(
      sql`update community_surveys set state = 'published', closed_at = null where id = ${f.id}`,
    );
  });
  it("checks draft replacements and deletions at commit, including SET CONSTRAINTS", async () => {
    const f = await survey();
    await failure(
      sql.begin(async (tx) => {
        await tx`delete from community_survey_options where id = ${f.options[0]}`;
      }),
    );
    await failure(
      sql.begin(async (tx) => {
        await tx`delete from community_survey_options where id = ${f.options[0]}`;
        await tx`set constraints all immediate`;
      }),
    );
    await failure(
      sql`update community_survey_options set survey_id = ${randomUUID()} where id = ${f.options[0]}`,
    );
    await failure(
      sql`update community_survey_options set id = ${randomUUID()} where id = ${f.options[0]}`,
    );
    await sql.begin(async (tx) => {
      await tx`delete from community_survey_options where survey_id = ${f.id}`;
      await tx`insert into community_survey_options(survey_id, label, position) values (${f.id}, 'Replacement A', 1), (${f.id}, 'Replacement B', 2)`;
    });
    await sql`delete from community_surveys where id = ${f.id}`;
    expect(
      await sql`select * from community_survey_options where survey_id = ${f.id}`,
    ).toHaveLength(0);
    // Creation and deletion in the same transaction leaves no deferred orphan check.
    await sql.begin(async (tx) => {
      const [row] =
        await tx`insert into community_surveys(project_id, question) values (${project}, 'Temporary') returning id`;
      await tx`delete from community_surveys where id = ${row.id}`;
    });
  });
  it("serializes simultaneous option removals without violating the lower bound", async () => {
    const f = await survey(3);
    const results = await Promise.allSettled(
      f.options.slice(0, 2).map((option) =>
        sql.begin(async (tx) => {
          await tx`delete from community_survey_options where id = ${option}`;
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await sql`select count(*)::int n from community_survey_options where survey_id = ${f.id}`)[0]
        .n,
    ).toBe(2);
  });
  it("aborts stale repeatable-read option writers rather than violating counts", async () => {
    const f = await survey(3);
    await failure(
      sql.begin("isolation level repeatable read", async (tx) => {
        await tx`select * from community_survey_options where survey_id = ${f.id}`;
        await sql`delete from community_survey_options where id = ${f.options[0]}`;
        await tx`delete from community_survey_options where id = ${f.options[1]}`;
      }),
      "40001",
    );
    expect(
      (await sql`select count(*)::int n from community_survey_options where survey_id = ${f.id}`)[0]
        .n,
    ).toBe(2);
  });
  it("serializes identical insert retries to one saved response", async () => {
    const f = await survey();
    await publish(f.id);
    await Promise.all(
      Array.from(
        { length: 3 },
        () =>
          sql`insert into community_survey_responses(survey_id, option_id, user_id) values (${f.id}, ${f.options[0]}, ${respondent}) on conflict do nothing`,
      ),
    );
    expect(
      await sql`select * from community_survey_responses where survey_id = ${f.id}`,
    ).toHaveLength(1);
  });
  it("rejects draft/closed answers, cross-survey options and response updates; arbitrates duplicate writers", async () => {
    const f = await survey(),
      other = await survey();
    await failure(vote(f.id, f.options[0]));
    await publish(f.id);
    await failure(vote(f.id, other.options[0]), "23503");
    const results = await Promise.allSettled([vote(f.id, f.options[0]), vote(f.id, f.options[1])]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "23505" },
    });
    await failure(
      sql`update community_survey_responses set option_id = option_id where survey_id = ${f.id}`,
    );
    // Open identical retries may DO NOTHING; the later service compares the winner.
    await sql`insert into community_survey_responses select * from community_survey_responses where survey_id = ${f.id} on conflict do nothing`;
    await close(f.id);
    await failure(
      sql`insert into community_survey_responses select * from community_survey_responses where survey_id = ${f.id} on conflict do nothing`,
    );
    await failure(vote(f.id, f.options[0], creator));
  });
  it("freezes published/closed content and provenance, including zero-response surveys", async () => {
    const f = await survey();
    await publish(f.id);
    for (const state of ["published", "closed"]) {
      if (state === "closed") await close(f.id);
      await failure(sql`update community_surveys set question = 'Changed' where id = ${f.id}`);
      await failure(
        sql`update community_surveys set project_id = ${randomUUID()} where id = ${f.id}`,
      );
      await failure(
        sql`update community_surveys set published_at = published_at + interval '1 second' where id = ${f.id}`,
      );
      await failure(sql`update community_surveys set created_by = null where id = ${f.id}`);
      await failure(
        sql`update community_survey_options set label = 'Changed' where id = ${f.options[0]}`,
      );
      await failure(sql`delete from community_survey_options where id = ${f.options[0]}`);
      await failure(
        sql`insert into community_survey_options(survey_id, label, position) values (${f.id}, 'Extra', 3)`,
      );
      await failure(sql`delete from community_surveys where id = ${f.id}`);
    }
  });
  async function waitForLock() {
    for (let i = 0; i < 100; i++) {
      if (
        (
          await sql`select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`
        ).length
      )
        return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Expected a concurrent SQL writer waiting on a lock");
  }
  it("orders close/response races using the survey row lock", async () => {
    const f = await survey();
    await publish(f.id);
    let started!: () => void, release!: () => void;
    const ready = new Promise<void>((r) => {
      started = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const closing = sql.begin(async (tx) => {
      await tx`update community_surveys set state = 'closed', closed_at = clock_timestamp() where id = ${f.id}`;
      started();
      await gate;
    });
    await ready;
    const pending = failure(vote(f.id, f.options[0]));
    try {
      await waitForLock();
    } finally {
      release();
    }
    await closing;
    await pending;
    const open = await survey();
    await publish(open.id);
    let voted!: () => void, commit!: () => void;
    const saved = new Promise<void>((r) => {
      voted = r;
    });
    const finish = new Promise<void>((r) => {
      commit = r;
    });
    const voting = sql.begin(async (tx) => {
      await tx`insert into community_survey_responses(survey_id, option_id, user_id) values (${open.id}, ${open.options[0]}, ${respondent})`;
      voted();
      await finish;
    });
    await saved;
    const closingAfterVote = close(open.id).execute();
    try {
      await waitForLock();
    } finally {
      commit();
    }
    await voting;
    await closingAfterVote;
    expect(
      await sql`select * from community_survey_responses where survey_id = ${open.id}`,
    ).toHaveLength(1);
  });
  it("keeps responses/options atomic on rollback", async () => {
    const f = await survey();
    await publish(f.id);
    await expect(
      sql.begin(async (tx) => {
        await tx`insert into community_survey_responses(survey_id, user_id, option_id) values (${f.id}, ${creator}, ${f.options[0]})`;
        throw new Error("Synthetic rollback");
      }),
    ).rejects.toThrow("Synthetic rollback");
    expect(
      await sql`select * from community_survey_responses where survey_id = ${f.id}`,
    ).toHaveLength(0);
  });
  it("restricts browser grants and enables RLS without policies", async () => {
    for (const table of [
      "community_surveys",
      "community_survey_options",
      "community_survey_responses",
    ]) {
      const [row] =
        await sql`select relrowsecurity enabled from pg_class where oid = ${table}::regclass`;
      expect(row.enabled).toBe(true);
      expect(
        await sql`select 1 from pg_class, lateral aclexplode(coalesce(relacl, acldefault('r', relowner))) acl where oid = ${table}::regclass and acl.grantee = 0`,
      ).toHaveLength(0);
      for (const role of ["anon", "authenticated"])
        for (const privilege of [
          "SELECT",
          "INSERT",
          "UPDATE",
          "DELETE",
          "TRUNCATE",
          "REFERENCES",
          "TRIGGER",
        ]) {
          expect(
            (await sql`select has_table_privilege(${role}, ${table}, ${privilege}) allowed`)[0]
              .allowed,
          ).toBe(false);
        }
      expect(await sql`select * from pg_policies where tablename = ${table}`).toHaveLength(0);
    }
    expect(
      await sql`select 1 from pg_proc, lateral aclexplode(coalesce(proacl, acldefault('f', proowner))) acl where proname like 'community_survey_%' and acl.grantee = 0`,
    ).toHaveLength(0);
  });
  it("cascades respondents/projects and clears creators even on published/closed surveys", async () => {
    const f = await survey();
    await publish(f.id);
    await vote(f.id, f.options[0]);
    await close(f.id);
    await sql`delete from app_users where id = ${respondent}`;
    expect(await sql`select * from community_survey_responses`).toHaveLength(0);
    // Leave a saved response present for the subsequent whole-project cascade.
    const remaining = await survey();
    await publish(remaining.id);
    await vote(remaining.id, remaining.options[0], creator);
    const survivor = randomUUID();
    await sql`insert into app_users(id, email) values (${survivor}, ${`${survivor}@example.test`})`;
    await vote(remaining.id, remaining.options[1], survivor);
    await sql`delete from app_users where id = ${creator}`;
    expect(await sql`select * from community_surveys where created_by is not null`).toHaveLength(0);
    expect(await sql`select * from community_survey_responses`).toHaveLength(1);
    await sql`delete from projects where id = ${project}`;
    for (const table of [
      "community_surveys",
      "community_survey_options",
      "community_survey_responses",
    ])
      expect(await sql.unsafe(`select * from ${table}`)).toHaveLength(0);
  });
});
