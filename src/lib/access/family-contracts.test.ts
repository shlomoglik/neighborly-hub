import { expect, it } from "vitest";
import { familyMutation } from "./family-contracts";
import { householdInvitationInput, joinInput } from "./invitation-contracts";
it("accepts only child profile actions and rejects forged identity, adult promotion and representative grants", () => {
  const input = {
    action: "addChild",
    requestId: crypto.randomUUID(),
    profile: { name: " Noa ", relation: null },
  };
  expect(familyMutation.parse(input).action).toBe("addChild");
  for (const extra of [
    { personId: crypto.randomUUID() },
    { isContactPerson: true },
    { householdId: crypto.randomUUID() },
    { isChild: false },
  ])
    expect(familyMutation.safeParse({ ...input, ...extra }).success).toBe(false);
  expect(
    familyMutation.safeParse({ ...input, profile: { ...input.profile, isChild: false } }).success,
  ).toBe(false);
});
it("rejects invitation scope overrides and requires a strictly named adult membership claim", () => {
  expect(householdInvitationInput.parse({})).toEqual({ expiresInDays: 7 });
  expect(
    householdInvitationInput.safeParse({
      householdId: crypto.randomUUID(),
      kind: "project_manager",
    }).success,
  ).toBe(false);
  expect(joinInput.parse({ fullName: " Adult " })).toEqual({ fullName: "Adult" });
  expect(joinInput.safeParse({ fullName: "Adult", personId: crypto.randomUUID() }).success).toBe(
    false,
  );
});
