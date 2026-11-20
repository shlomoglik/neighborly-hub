// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate } from "@/lib/i18n/dictionary";
vi.mock("next/navigation", () => ({ usePathname: () => "/directory" }));
vi.mock("./AppHeaderMenu", () => ({ AppHeaderMenu: () => null }));
import { AppShell } from "./AppShell";
afterEach(cleanup);
it("keeps the three core destinations and account access without a primary join tab", () => {
  render(
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      <AppShell>Content</AppShell>
    </I18nContext.Provider>,
  );
  const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
  expect(hrefs).not.toContain("/join");
  for (const href of ["/directory", "/household", "/manage", "/account"])
    expect(hrefs).toContain(href);
});
