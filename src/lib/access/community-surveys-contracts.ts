import { z } from "zod";
export const surveyId = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
export const surveyAnswer = z.object({ optionId: surveyId }).strict();
export const surveyQuery = z
  .object({ page: z.coerce.number().int().min(1).max(10000).default(1) })
  .strict();
export const SURVEY_PAGE_SIZE = 20;
export class SurveyError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
