import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import {
  feedbackInput,
  feedbackQuery,
  FEEDBACK_PAGE_SIZE,
  type FeedbackInput,
} from "./product-feedback-contracts";
type Database = PostgresJsDatabase<typeof s>;
export class FeedbackError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export async function submitFeedback(db: Database, authorId: string, input: FeedbackInput) {
  const parsed = feedbackInput.safeParse(input);
  if (!parsed.success) throw new FeedbackError(400, "INVALID_INPUT");
  const { submissionId, message } = parsed.data;
  return db.transaction(
    async (tx) => {
      const [created] = await tx
        .insert(s.productFeedback)
        .values({ authorUserId: authorId, submissionId, message })
        .onConflictDoNothing({
          target: [s.productFeedback.authorUserId, s.productFeedback.submissionId],
        })
        .returning({ id: s.productFeedback.id });
      if (created) return created;
      // READ COMMITTED: the next statement sees the winner after the unique-index wait.
      const [saved] = await tx
        .select({ id: s.productFeedback.id, message: s.productFeedback.message })
        .from(s.productFeedback)
        .where(
          and(
            eq(s.productFeedback.authorUserId, authorId),
            eq(s.productFeedback.submissionId, submissionId),
          ),
        );
      if (!saved || saved.message !== message) throw new FeedbackError(409, "IDEMPOTENCY_CONFLICT");
      return { id: saved.id };
    },
    { isolationLevel: "read committed" },
  );
}
export async function listFeedback(db: Database, actorId: string, page = 1) {
  const parsed = feedbackQuery.safeParse({ page });
  if (!parsed.success) throw new FeedbackError(400, "INVALID_INPUT");
  return db.transaction(async (tx) => {
    // Temporary pilot reviewer policy; community grants intentionally play no part.
    const admins = await tx
      .select({ role: s.globalRoles.role })
      .from(s.globalRoles)
      .where(and(eq(s.globalRoles.userId, actorId), eq(s.globalRoles.role, "admin")))
      .for("share");
    if (!admins.length) throw new FeedbackError(403, "FORBIDDEN");
    const rows = await tx
      .select({
        id: s.productFeedback.id,
        authorUserId: s.productFeedback.authorUserId,
        message: s.productFeedback.message,
        createdAt: s.productFeedback.createdAt,
      })
      .from(s.productFeedback)
      .orderBy(desc(s.productFeedback.createdAt), desc(s.productFeedback.id))
      .limit(FEEDBACK_PAGE_SIZE + 1)
      .offset((page - 1) * FEEDBACK_PAGE_SIZE);
    return {
      feedback: rows.slice(0, FEEDBACK_PAGE_SIZE),
      page,
      hasNext: rows.length > FEEDBACK_PAGE_SIZE,
    };
  });
}
