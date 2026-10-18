// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nContext } from "@/lib/i18n/context";
import { translate, directionFor } from "@/lib/i18n/dictionary";
import { AppHeaderMenu } from "./AppHeaderMenu";

afterEach(cleanup);

it.each(["he", "en", "ru"] as const)(
  "offers account access and all languages in the %s menu using the keyboard",
  async (lang) => {
    const setLang = vi.fn();
    render(
      <I18nContext.Provider
        value={{ lang, dir: directionFor(lang), setLang, t: (key) => translate(lang, key) }}
      >
        <AppHeaderMenu />
      </I18nContext.Provider>,
    );
    const trigger = screen.getByRole("button", { name: translate(lang, "appMenu") });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const account = await screen.findByRole("menuitem", { name: translate(lang, "authAccount") });
    expect(account.getAttribute("href")).toBe("/account");
    for (const [value, name] of [
      ["he", "עברית"],
      ["en", "English"],
      ["ru", "Русский"],
    ]) {
      expect(screen.getByRole("menuitemradio", { name }).getAttribute("aria-checked")).toBe(
        String(value === lang),
      );
    }
    const next = lang === "en" ? "he" : "en";
    const option = screen.getByRole("menuitemradio", { name: next === "en" ? "English" : "עברית" });
    option.focus();
    fireEvent.keyDown(option, { key: "Enter" });
    expect(setLang).toHaveBeenCalledWith(next);
  },
);
