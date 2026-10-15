import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/features/directory/LiveDirectory", () => ({ LiveDirectory: () => null }));
import { requireCurrentUser } from "@/lib/auth/session";
import DirectoryPage from "./page";
beforeEach(() => vi.resetAllMocks());
it("requires a verified session before rendering the live directory", async () => {
  vi.mocked(requireCurrentUser).mockResolvedValue({
    id: "user",
    email: "a@example.test",
    name: "A",
  });
  expect(await DirectoryPage()).toBeTruthy();
  expect(requireCurrentUser).toHaveBeenCalledOnce();
});
it("does not fall back to synthetic data when the session guard redirects or fails", async () => {
  vi.mocked(requireCurrentUser).mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(DirectoryPage()).rejects.toThrow("NEXT_REDIRECT");
});
