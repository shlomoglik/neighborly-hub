import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { LANG_COOKIE } from "./lib/i18n/dictionary";

it.each(["he", "en", "ru"])(
  "opens the vision in %s regardless of the visitor's previous language",
  (lang) => {
    const request = new NextRequest(`https://neighborly.example/vision?lang=${lang}&from=readme`, {
      headers: { Cookie: `${LANG_COOKIE}=ru` },
    });
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("https://neighborly.example/vision?from=readme");
    expect(response.cookies.get(LANG_COOKIE)).toMatchObject({
      value: lang,
      path: "/",
      secure: true,
      sameSite: "lax",
      maxAge: 31536000,
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  },
);

it.each(["", "?lang=invalid", "?lang=en-US"])(
  "preserves the normal cookie-based page for %s",
  (query) => {
    const response = middleware(new NextRequest(`https://neighborly.example/vision${query}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Location")).toBeNull();
    expect(response.cookies.get(LANG_COOKIE)).toBeUndefined();
  },
);

it("supports local HTTP development without requiring secure cookies", () => {
  const response = middleware(new NextRequest("http://localhost:3000/vision?lang=en"));
  expect(response.cookies.get(LANG_COOKIE)?.secure).toBe(false);
});
