import { expect, it } from "vitest";
import QRCode from "qrcode";
import { whatsappHref, emailHref } from "./sharing";
import { authReturnPath } from "@/features/auth/return-path";
it("encodes WhatsApp messages and optional phone without network delivery", () => {
  const message = "הזמנה & link https://example.test/join/abc";
  expect(whatsappHref(message, "050-123-4567")).toBe(
    `https://wa.me/972501234567?text=${encodeURIComponent(message)}`,
  );
  expect(whatsappHref(message, "+1 (202) 555-0101")).toContain("wa.me/12025550101?");
  expect(whatsappHref(message)).toBe(`https://wa.me/?text=${encodeURIComponent(message)}`);
  expect(whatsappHref(message, "not a phone")).toBeNull();
});
it("prefills email subject/body without interpreting message parameters", () => {
  const url = emailHref("Project & A", "קישור\nhttps://example.test/?x=1&y=2", "user@example.test");
  expect(url).toBe(
    `mailto:user%40example.test?subject=${encodeURIComponent("Project & A")}&body=${encodeURIComponent("קישור\nhttps://example.test/?x=1&y=2")}`,
  );
});
it("renders an actual local SVG QR without an external QR service", async () => {
  const svg = await QRCode.toString(`https://example.test/join/${"a".repeat(64)}`, {
    type: "svg",
    margin: 4,
  });
  expect(svg).toContain("<svg");
  expect(svg).toContain("<path");
  expect(svg).not.toContain("<script");
  expect(svg).not.toContain("<image");
});
it("preserves only validated local invitation paths through authentication", () => {
  const path = `/join/${"a".repeat(64)}`;
  expect(authReturnPath(path)).toBe(path);
  expect(authReturnPath("/join")).toBe("/join");
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/join/abc",
    `${path}?next=evil`,
    "/manage",
    undefined,
  ])
    expect(authReturnPath(value)).toBe("/directory");
});
