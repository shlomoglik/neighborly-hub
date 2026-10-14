import { describe, expect, it } from "vitest";
import { DEFAULT_LANG, LANG_COOKIE, dict, directionFor, isLang, translate } from "./dictionary";

describe("localization", () => {
  it("defaults to Hebrew and stores the expected cookie name", () => {
    expect(DEFAULT_LANG).toBe("he");
    expect(LANG_COOKIE).toBe("neighborly_lang");
  });

  it("accepts only supported languages", () => {
    expect(["he", "en", "ru"].every(isLang)).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });

  it("uses RTL for Hebrew and LTR for other supported languages", () => {
    expect(directionFor("he")).toBe("rtl");
    expect(directionFor("en")).toBe("ltr");
    expect(directionFor("ru")).toBe("ltr");
  });

  it("provides a nonempty translation for every language and key", () => {
    for (const entry of Object.values(dict)) {
      for (const lang of ["he", "en", "ru"] as const) {
        expect(typeof entry[lang]).toBe("string");
        expect(entry[lang].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("translates application title in each language", () => {
    expect(translate("he", "appName")).toBe(dict.appName.he);
    expect(translate("en", "appName")).toBe(dict.appName.en);
    expect(translate("ru", "appName")).toBe(dict.appName.ru);
  });
});
