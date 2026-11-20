// @vitest-environment jsdom
import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "./ResponsiveFormDialog";
afterEach(cleanup);
it("blocks closing while a write is pending and labels the dialog and close action", () => {
  const onOpenChange = vi.fn();
  const focus = createRef<HTMLHeadingElement>();
  const view = (busy: boolean) => (
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      <h2 ref={focus}>List</h2>
      <ResponsiveFormDialog
        open
        onOpenChange={onOpenChange}
        busy={busy}
        fallbackFocus={focus}
        title="Create item"
        description="Creates an item in this project."
        trigger={<Button>Add</Button>}
      >
        <label>
          Email
          <input />
        </label>
      </ResponsiveFormDialog>
    </I18nContext.Provider>
  );
  const rendered = render(view(true));
  expect(
    screen.getByRole("dialog", { name: "Create item" }).getAttribute("aria-describedby"),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Close" })).toHaveProperty("disabled", true);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onOpenChange).not.toHaveBeenCalled();
  rendered.rerender(view(false));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});
