import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/features/management/LiveManagement", () => ({ LiveManagement: () => null }));
import { requireCurrentUser } from "@/lib/auth/session";
import ManagePage from "./page";
beforeEach(() => vi.resetAllMocks());
it("guards the live workspace and preserves direct project selection", async () => {
  vi.mocked(requireCurrentUser).mockResolvedValue({
    id: "user",
    email: "a@example.test",
    name: "A",
  });
  const page = await ManagePage({ searchParams: Promise.resolve({ project: "chosen" }) });
  expect(requireCurrentUser).toHaveBeenCalledOnce();
  expect(page.props.projectId).toBe("chosen");
  expect(
    (await ManagePage({ searchParams: Promise.resolve({ project: ["a", "b"] }) })).props.projectId,
  ).toBe("invalid");
});
it("never renders a preview when authentication redirects", async () => {
  vi.mocked(requireCurrentUser).mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(ManagePage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
});
