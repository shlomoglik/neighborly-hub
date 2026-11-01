import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({
  readAuthConfig: vi.fn(() => ({ baseURL: "https://app.test" })),
}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("./community-surveys-resident", () => ({ readSurveys: vi.fn(), answerSurvey: vi.fn() }));
import { getCurrentUser } from "@/lib/auth/session";
import { readAuthConfig } from "@/lib/auth/config";
import { readSurveys, answerSurvey } from "./community-surveys-resident";
import { SurveyError } from "./community-surveys-contracts";
import { surveyRoute } from "./community-surveys-http";
const projectId = crypto.randomUUID(),
  surveyId = crypto.randomUUID(),
  optionId = crypto.randomUUID();
const context = { params: Promise.resolve({ projectId, surveyId }) };
function request(body = JSON.stringify({ optionId })) {
  return new Request("https://app.test", {
    method: "PUT",
    headers: {
      origin: "https://app.test",
      "content-type": "application/json",
      "x-user-id": "forged",
    },
    body,
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "session-user",
    email: "private@example.test",
    name: "Private",
  });
  vi.mocked(readAuthConfig).mockReturnValue({ baseURL: "https://app.test", secret: "test" });
  vi.mocked(answerSurvey).mockResolvedValue({ optionId });
});
it("uses the signed session identity and canonical UUID choice", async () => {
  const response = await surveyRoute(
    request(JSON.stringify({ optionId: optionId.toUpperCase() })),
    {
      params: Promise.resolve({
        projectId: projectId.toUpperCase(),
        surveyId: surveyId.toUpperCase(),
      }),
    },
    true,
  );
  expect(response.status).toBe(200);
  expect(answerSurvey).toHaveBeenCalledWith({}, "session-user", projectId, surveyId, optionId);
});
it("sanitizes unexpected errors and keeps every response private", async () => {
  for (const cause of [
    new Error("private SQL with choices"),
    new SurveyError(409, "SURVEY_CLOSED"),
  ]) {
    vi.mocked(answerSurvey).mockRejectedValueOnce(cause);
    const response = await surveyRoute(request(), context, true);
    expect(await response.json()).toEqual({
      error: cause instanceof SurveyError ? cause.code : "INTERNAL_ERROR",
    });
    expect(response.status).toBe(cause instanceof SurveyError ? cause.status : 500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  }
});
it("authenticates before malformed paths and fails closed without configured Origin", async () => {
  vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
  expect(
    (await surveyRoute(request(), { params: Promise.resolve({ projectId: "bad" }) }, true)).status,
  ).toBe(401);
  vi.mocked(readAuthConfig).mockReturnValueOnce(null);
  expect((await surveyRoute(request(), context, true)).status).toBe(403);
  expect(answerSurvey).not.toHaveBeenCalled();
  expect(readSurveys).not.toHaveBeenCalled();
});
it("rejects repeated keys including escaped spellings, but accepts escaped valid UUIDs", async () => {
  for (const key of ['"optionId"', '"option\\u0049d"']) {
    expect(
      (await surveyRoute(request(`{"optionId":"${optionId}",${key}:"${optionId}"}`), context, true))
        .status,
    ).toBe(400);
  }
  expect(
    (await surveyRoute(request(`{"option\\u0049d":"${optionId}"}`), context, true)).status,
  ).toBe(200);
});
