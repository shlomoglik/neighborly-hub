import { surveyRoute, type SurveyContext } from "@/lib/access/community-surveys-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const PUT = (request: Request, context: SurveyContext) =>
  surveyRoute(request, context, true);
