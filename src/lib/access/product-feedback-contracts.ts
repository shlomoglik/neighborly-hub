import { z } from "zod";
export const feedbackInput = z
  .object({
    submissionId: z.string().uuid(),
    message: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .refine((value) => !value.includes("\0") && value.isWellFormed()),
  })
  .strict();
export const feedbackQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
export const FEEDBACK_PAGE_SIZE = 20;
export type FeedbackInput = z.infer<typeof feedbackInput>;
