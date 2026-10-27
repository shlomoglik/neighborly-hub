import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/features/management/LiveManagement", () => ({ LiveManagement: () => null }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
import { requireCurrentUser } from "@/lib/auth/session";
import ProjectPage from "./page";
const id = "c44c9aec-f8e4-46b3-9957-12ceba088994";
beforeEach(() => vi.resetAllMocks());
it("authenticates before rendering a dedicated project workspace", async () => {
  const page = await ProjectPage({ params: Promise.resolve({ id }) });
  expect(requireCurrentUser).toHaveBeenCalledOnce();
  expect(page.props.projectId).toBe(id);
});
it("rejects malformed identifiers and never renders after an authentication redirect", async () => {
  await expect(ProjectPage({ params: Promise.resolve({ id: "invalid" }) })).rejects.toThrow(
    "NOT_FOUND",
  );
  vi.mocked(requireCurrentUser).mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(ProjectPage({ params: Promise.resolve({ id }) })).rejects.toThrow("NEXT_REDIRECT");
});
