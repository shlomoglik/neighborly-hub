import test from "node:test";
import assert from "node:assert/strict";
import { run } from "./pr-size-runner.mjs";
import { MARKER } from "./pr-size.mjs";

const env = {
  GITHUB_TOKEN: "test-only",
  GITHUB_REPOSITORY: "owner/repo",
  PR_NUMBER: "61",
  PR_HEAD_SHA: "head",
};
function harness({
  files = [{ filename: "a.ts", additions: 1 }],
  comments = [],
  pull = {},
  latest = {},
  errorPath,
} = {}) {
  const metadata = {
    changed_files: files.length,
    head: { sha: "head" },
    base: { sha: "base" },
    ...pull,
  };
  const writes = [];
  const reads = [];
  let pullReads = 0;
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-only");
    assert.ok(options.signal instanceof AbortSignal);
    const { pathname, searchParams } = new URL(url);
    if (options.method) {
      writes.push({ pathname, ...options, body: JSON.parse(options.body) });
      return Response.json({ id: 1 });
    }
    reads.push(url);
    if (pathname === errorPath) return new Response("private error details", { status: 403 });
    if (pathname.endsWith("/pulls/61"))
      return Response.json(pullReads++ === 0 ? metadata : { ...metadata, ...latest });
    const data = pathname.endsWith("/files") ? files : comments;
    const start = (Number(searchParams.get("page")) - 1) * 100;
    return Response.json(data.slice(start, start + 100));
  };
  return { writes, reads, options: { env, fetchImpl, log() {} } };
}

test("paginates files and comments, updates only its own existing comment", async () => {
  const h = harness({
    files: Array.from({ length: 101 }, (_, i) => ({ filename: `src/${i}.ts`, additions: 1 })),
    comments: [
      ...Array.from({ length: 100 }, () => ({
        user: { login: "other[bot]", type: "Bot" },
        body: MARKER,
        id: 2,
      })),
      { user: { login: "github-actions[bot]" }, body: `${MARKER}\nold`, id: 3 },
    ],
  });
  assert.equal((await run(h.options)).totalEffectiveLOC, 101);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].method, "PATCH");
  assert.equal(h.writes[0].pathname, "/repos/owner/repo/issues/comments/3");
  assert.match(h.writes[0].body.body, /101/);
  assert.ok(h.reads.some((url) => url.endsWith("page=2")));
});

test("publishes a failing report before returning failure status", async () => {
  const h = harness({ files: [{ filename: "a.ts", additions: 801 }] });
  assert.equal((await run(h.options)).status, "fail");
  assert.equal(h.writes[0].method, "POST");
  assert.match(h.writes[0].body.body, /hard limit/);
});

test("refuses incomplete, unsupported or stale reports before commenting", async () => {
  for (const config of [
    { pull: { changed_files: 3001 } },
    { pull: { changed_files: 2 } },
    { pull: { head: { sha: "other" } } },
    { latest: { head: { sha: "new" } } },
    { latest: { base: { sha: "new" } } },
    { errorPath: "/repos/owner/repo/pulls/61/files" },
  ]) {
    const h = harness(config);
    await assert.rejects(run(h.options));
    assert.equal(h.writes.length, 0);
  }
});

test("accepts exactly 3000 files and a full final page", async () => {
  const h = harness({
    files: Array.from({ length: 3000 }, () => ({ filename: "docs/a.md", additions: 1 })),
  });
  assert.equal((await run(h.options)).totalEffectiveLOC, 300);
  assert.ok(!h.reads.some((url) => url.endsWith("page=31")));
  assert.equal(h.writes.length, 1);
});

test("validates configuration before making any API calls", async () => {
  for (const override of [
    { GITHUB_TOKEN: "" },
    { PR_NUMBER: "-1" },
    { PR_NUMBER: "1.2" },
    { GITHUB_REPOSITORY: "invalid/repo/path" },
  ]) {
    const h = harness();
    await assert.rejects(run({ ...h.options, env: { ...env, ...override } }), /required/);
    assert.equal(h.reads.length, 0);
  }
});

test("API errors omit response bodies", async () => {
  const h = harness({ errorPath: "/repos/owner/repo/pulls/61" });
  await assert.rejects(
    run(h.options),
    (error) => error.message.includes("403") && !error.message.includes("private"),
  );
});
