// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nContext } from "@/lib/i18n/context";
import { directionFor, translate, type Lang } from "@/lib/i18n/dictionary";

const { cookie, requireCurrentUser } = vi.hoisted(() => ({
  cookie: vi.fn(),
  requireCurrentUser: vi.fn(() => {
    throw new Error("Authentication must not be required");
  }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/vision" }));
vi.mock("@/lib/auth/session", () => ({ requireCurrentUser }));
import VisionPage, { generateMetadata } from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it.each(["he", "en", "ru"] as const)(
  "renders public content and metadata in %s without a session",
  async (lang: Lang) => {
    cookie.mockReturnValue({ value: lang });
    const { container } = render(
      <I18nContext.Provider
        value={{
          lang,
          dir: directionFor(lang),
          setLang: () => {},
          t: (key) => translate(lang, key),
        }}
      >
        <VisionPage />
      </I18nContext.Provider>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      translate(lang, "visionHero"),
    );
    for (const key of [
      "visionDirectoryTitle",
      "visionGrowthTitle",
      "visionValuesTitle",
      "visionPilotTitle",
    ] as const) {
      expect(screen.getByRole("heading", { name: translate(lang, key), level: 2 })).toBeTruthy();
    }
    for (const key of [
      "visionIntro",
      "visionHomeBody",
      "visionDirectoryBody",
      "visionGrowthBody",
      "visionPilotBody",
    ] as const) {
      expect(screen.getByText(translate(lang, key))).toBeTruthy();
    }
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(
      screen.getByRole("link", { name: translate(lang, "visionTitle") }).getAttribute("href"),
    ).toBe("/vision");
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("form")).toBeNull();
    expect(await generateMetadata()).toEqual({
      title: `${translate(lang, "visionTitle")} | ${translate(lang, "appName")}`,
      description: translate(lang, "visionIntro"),
    });
    expect(requireCurrentUser).not.toHaveBeenCalled();
  },
);

it.each([undefined, "unsupported"])("defaults metadata to Hebrew for cookie %s", async (value) => {
  cookie.mockReturnValue(value ? { value } : undefined);
  expect((await generateMetadata()).description).toBe(translate("he", "visionIntro"));
});
