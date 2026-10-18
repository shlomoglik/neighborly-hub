import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/features/households/LiveFamily", () => ({ LiveFamily: () => null }));
vi.mock("@/features/households/MyHouseholds", () => ({ MyHouseholds: () => null }));
vi.mock("@/features/households/HouseholdDetails", () => ({ HouseholdDetails: () => null }));
import { requireCurrentUser } from "@/lib/auth/session";
import FamilyPage from "./[id]/members/page";
import MyHouseholdPage from "./page";
import HouseholdPage from "./[id]/page";
it("requires authentication before rendering household discovery or details", async () => {
  vi.mocked(requireCurrentUser).mockRejectedValue(new Error("sign-in required"));
  await expect(MyHouseholdPage()).rejects.toThrow("sign-in required");
  await expect(FamilyPage({ params: Promise.resolve({ id: "home" }) })).rejects.toThrow(
    "sign-in required",
  );
  await expect(HouseholdPage({ params: Promise.resolve({ id: "home" }) })).rejects.toThrow(
    "sign-in required",
  );
});
