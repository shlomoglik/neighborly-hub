import { surveyRoute, type SurveyContext } from "@/lib/access/community-surveys-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request, context: SurveyContext) => surveyRoute(request, context);
