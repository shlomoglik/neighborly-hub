import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/features/management/LiveManagement", () => ({ LiveManagement: () => null }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error("REDIRECT:" + path);
  }),
}));
import { requireCurrentUser } from "@/lib/auth/session";
import ManagePage from "./page";
beforeEach(() => vi.resetAllMocks());
it("guards the project list and redirects legacy project links", async () => {
  vi.mocked(requireCurrentUser).mockResolvedValue({
    id: "user",
    email: "a@example.test",
    name: "A",
  });
  const page = await ManagePage({ searchParams: Promise.resolve({}) });
  expect(requireCurrentUser).toHaveBeenCalledOnce();
  expect(page.props.projectId).toBe("");
  await expect(
    ManagePage({ searchParams: Promise.resolve({ project: "chosen" }) }),
  ).rejects.toThrow("REDIRECT:/manage/project/chosen");
  await expect(
    ManagePage({ searchParams: Promise.resolve({ project: ["a", "b"] }) }),
  ).rejects.toThrow("REDIRECT:/manage");
});
it("never renders a preview when authentication redirects", async () => {
  vi.mocked(requireCurrentUser).mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(ManagePage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
});
