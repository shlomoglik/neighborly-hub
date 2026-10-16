import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/lib/access/project-setup", () => ({ canCreateProject: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/features/management/LiveStaff", () => ({ LiveStaff: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import StaffPage from "./page";
import { requireCurrentUser } from "@/lib/auth/session";
import { canCreateProject } from "@/lib/access/project-setup";
const projectId = "c44c9aec-f8e4-46b3-9957-12ceba088994";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireCurrentUser).mockResolvedValue({
    id: "verified",
    email: "a@example.test",
    name: "A",
  });
});
it("requires a verified session and current global admin grant before rendering", async () => {
  vi.mocked(canCreateProject).mockResolvedValue(true);
  expect((await StaffPage({ params: Promise.resolve({ projectId }) })).props.projectId).toBe(
    projectId,
  );
  expect(canCreateProject).toHaveBeenCalledWith({}, "verified");
  vi.mocked(canCreateProject).mockResolvedValue(false);
  await expect(StaffPage({ params: Promise.resolve({ projectId }) })).rejects.toThrow("NOT_FOUND");
});
it("protects invalid IDs and follows the existing authentication redirect", async () => {
  await expect(StaffPage({ params: Promise.resolve({ projectId: "bad" }) })).rejects.toThrow(
    "NOT_FOUND",
  );
  vi.mocked(requireCurrentUser).mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(StaffPage({ params: Promise.resolve({ projectId }) })).rejects.toThrow(
    "NEXT_REDIRECT",
  );
});
