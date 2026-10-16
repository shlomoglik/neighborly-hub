import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/lib/access/project-setup", () => ({ canCreateProject: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/features/management/ProjectSetupWizard", () => ({ ProjectSetupWizard: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found");
  },
}));
import { requireCurrentUser } from "@/lib/auth/session";
import { canCreateProject } from "@/lib/access/project-setup";
import Page from "./page";
beforeEach(() => vi.resetAllMocks());
it("requires authentication before checking grants", async () => {
  vi.mocked(requireCurrentUser).mockRejectedValue(new Error("sign in"));
  await expect(Page()).rejects.toThrow("sign in");
  expect(canCreateProject).not.toHaveBeenCalled();
});
it("hides the wizard from non-admins", async () => {
  vi.mocked(requireCurrentUser).mockResolvedValue({
    id: "verified",
    email: "a@example.test",
    name: "A",
  });
  vi.mocked(canCreateProject).mockResolvedValue(false);
  await expect(Page()).rejects.toThrow("not found");
});
it("renders the connected wizard for a database-authorized administrator", async () => {
  vi.mocked(requireCurrentUser).mockResolvedValue({
    id: "verified",
    email: "a@example.test",
    name: "A",
  });
  vi.mocked(canCreateProject).mockResolvedValue(true);
  expect(await Page()).toBeTruthy();
  expect(canCreateProject).toHaveBeenCalledWith({}, "verified");
});
