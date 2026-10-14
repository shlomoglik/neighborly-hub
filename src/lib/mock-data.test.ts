import { describe, expect, it } from "vitest";
import { buildings, households, toWhatsApp } from "./mock-data";

describe("mock directory", () => {
  it("has unique household identifiers and known buildings", () => {
    expect(new Set(households.map(({ id }) => id)).size).toBe(households.length);
    for (const household of households) {
      expect(buildings).toContain(household.building);
    }
  });

  it.each([
    ["050-1234567", "https://wa.me/972501234567"],
    ["+972-50-1234567", "https://wa.me/972501234567"],
    ["00972 50 1234567", "https://wa.me/972501234567"],
  ])("normalizes %s to WhatsApp", (phone, expected) => {
    expect(toWhatsApp(phone)).toBe(expected);
  });
});
