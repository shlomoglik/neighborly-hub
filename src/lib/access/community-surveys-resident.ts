import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import { loadGrants } from "./grants";
import { SurveyError, SURVEY_PAGE_SIZE } from "./community-surveys-contracts";
type Database = PostgresJsDatabase<typeof s>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const unavailable = () => new SurveyError(404, "NOT_FOUND");
const summary = {
  id: s.communitySurveys.id,
  question: s.communitySurveys.question,
  state: s.communitySurveys.state,
  publishedAt: s.communitySurveys.publishedAt,
  closedAt: s.communitySurveys.closedAt,
};
function eligible(tx: Transaction, userId: string, projectId: string) {
  return tx
    .select({ id: s.householdMembers.id })
    .from(s.userPersonLinks)
    .innerJoin(s.people, eq(s.people.partyId, s.userPersonLinks.personId))
    .innerJoin(s.householdMembers, eq(s.householdMembers.personId, s.people.partyId))
    .innerJoin(s.households, eq(s.households.id, s.householdMembers.householdId))
    .innerJoin(s.apartments, eq(s.apartments.id, s.households.apartmentId))
    .innerJoin(s.buildings, eq(s.buildings.id, s.apartments.buildingId))
    .where(
      and(
        eq(s.userPersonLinks.userId, userId),
        eq(s.people.isChild, false),
        eq(s.householdMembers.isManagedChild, false),
        eq(s.households.isActive, true),
        eq(s.households.approvalStatus, "approved"),
        eq(s.buildings.projectId, projectId),
      ),
    )
    .orderBy(s.householdMembers.id);
}
async function ownAnswer(tx: Transaction, userId: string, id: string) {
  const [answer] = await tx
    .select({ optionId: s.communitySurveyResponses.optionId })
    .from(s.communitySurveyResponses)
    .where(
      and(
        eq(s.communitySurveyResponses.surveyId, id),
        eq(s.communitySurveyResponses.userId, userId),
      ),
    );
  return answer ?? null;
}
export async function readSurveys(
  db: Database,
  userId: string,
  projectId: string,
  id?: string,
  page = 1,
) {
  return db.transaction(
    async (tx) => {
      const resident = (await eligible(tx, userId, projectId)).length > 0;
      if (!resident) {
        if (!id) throw unavailable();
        const grants = await loadGrants(tx, userId);
        if (
          !grants.admin &&
          !grants.staff.some((g) => g.projectId === projectId && g.role === "project_manager")
        )
          throw unavailable();
      }
      const query = tx
        .select(summary)
        .from(s.communitySurveys)
        .where(
          and(
            eq(s.communitySurveys.projectId, projectId),
            inArray(s.communitySurveys.state, ["published", "closed"]),
            id ? eq(s.communitySurveys.id, id) : undefined,
          ),
        );
      if (!id) {
        const rows = await query
          .orderBy(desc(s.communitySurveys.createdAt), desc(s.communitySurveys.id))
          .limit(SURVEY_PAGE_SIZE + 1)
          .offset((page - 1) * SURVEY_PAGE_SIZE);
        return {
          surveys: rows.slice(0, SURVEY_PAGE_SIZE),
          page,
          hasNext: rows.length > SURVEY_PAGE_SIZE,
        };
      }
      const [survey] = await query;
      if (!survey) throw unavailable();
      const options = await tx
        .select({
          id: s.communitySurveyOptions.id,
          label: s.communitySurveyOptions.label,
          position: s.communitySurveyOptions.position,
        })
        .from(s.communitySurveyOptions)
        .where(eq(s.communitySurveyOptions.surveyId, id))
        .orderBy(s.communitySurveyOptions.position);
      return { ...survey, options, ownResponse: resident ? await ownAnswer(tx, userId, id) : null };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function answerSurvey(
  db: Database,
  userId: string,
  projectId: string,
  id: string,
  optionId: string,
) {
  return db.transaction(
    async (tx) => {
      // Lock every row in qualifying identity/home paths before the survey. Share locks
      // conflict with deletion and non-key updates (approval, child flags, scope).
      const paths = await eligible(tx, userId, projectId).for("share");
      // A fresh READ COMMITTED statement rechecks joins after any lock wait.
      const current = await eligible(tx, userId, projectId);
      if (!current.some((row) => paths.some((path) => path.id === row.id))) throw unavailable();
      const [survey] = await tx
        .select(summary)
        .from(s.communitySurveys)
        .where(and(eq(s.communitySurveys.id, id), eq(s.communitySurveys.projectId, projectId)))
        .for("share");
      if (!survey || survey.state === "draft") throw unavailable();
      if (survey.state !== "published") throw new SurveyError(409, "SURVEY_CLOSED");
      const [option] = await tx
        .select({ id: s.communitySurveyOptions.id })
        .from(s.communitySurveyOptions)
        .where(
          and(eq(s.communitySurveyOptions.surveyId, id), eq(s.communitySurveyOptions.id, optionId)),
        );
      if (!option) throw new SurveyError(400, "INVALID_INPUT");
      await tx
        .insert(s.communitySurveyResponses)
        .values({ surveyId: id, userId, optionId })
        .onConflictDoNothing({
          target: [s.communitySurveyResponses.surveyId, s.communitySurveyResponses.userId],
        });
      // The unique-index wait finishes before this fresh snapshot reads the winner.
      const saved = await ownAnswer(tx, userId, id);
      if (!saved || saved.optionId !== optionId) throw new SurveyError(409, "ALREADY_RESPONDED");
      return saved;
    },
    { isolationLevel: "read committed" },
  );
}
