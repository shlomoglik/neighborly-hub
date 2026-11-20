import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/features/product-feedback/ProductFeedback", () => ({ ProductFeedback: () => null }));
import { requireCurrentUser } from "@/lib/auth/session";
import { ProductFeedback } from "@/features/product-feedback/ProductFeedback";
import Page from "./page";
afterEach(() => vi.resetAllMocks());
it("requires a signed-in account", async () => {
  vi.mocked(requireCurrentUser).mockRejectedValue(new Error("sign-in required"));
  await expect(Page()).rejects.toThrow("sign-in required");
});
it.each(["approved", "pending", "unlinked"])(
  "allows an authenticated %s account without a membership guard",
  async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue({
      id: "account",
      name: "Resident",
      email: "resident@example.test",
    });
    expect((await Page()).type).toBe(ProductFeedback);
    expect(requireCurrentUser).toHaveBeenCalledOnce();
  },
);
