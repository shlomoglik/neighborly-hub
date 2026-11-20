import { expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
import { requireCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Page from "./page";
it("keeps old join links authenticated and redirects request history into account", async () => {
  await expect(Page()).rejects.toThrow("REDIRECT");
  expect(requireCurrentUser).toHaveBeenCalledOnce();
  expect(redirect).toHaveBeenCalledWith("/account#join-requests");
});
