// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate, directionFor, type Lang } from "@/lib/i18n/dictionary";
import { StructureEditor, type StructureEditorProps } from "./StructureEditor";
afterEach(cleanup);
function mount(lang: Lang = "en", overrides: Partial<StructureEditorProps> = {}) {
  const props: StructureEditorProps = {
    target: { mode: "create", entity: "building" },
    busy: false,
    error: null,
    onSave: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    onReload: vi.fn(),
    ...overrides,
  };
  render(
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <StructureEditor {...props} />
    </I18nContext.Provider>,
  );
  return props;
}
it.each(["he", "en", "ru"] as const)(
  "localizes create controls and validates a structural label in %s",
  async (lang) => {
    const p = mount(lang);
    const save = screen.getByRole("button", { name: translate(lang, "save") });
    expect(save.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText(translate(lang, "name")), {
      target: { value: " New building " },
    });
    fireEvent.submit(save.closest("form")!);
    await waitFor(() => expect(p.onSave).toHaveBeenCalledExactlyOnceWith(" New building ", ""));
    expect(screen.getByRole("alertdialog").textContent).toContain(
      translate(lang, "structureEditHint"),
    );
  },
);
it("accepts ground/negative integer floors, rejects blank/fractional/overflow values, and keeps textual apartment labels", () => {
  mount("en", {
    target: { mode: "create", entity: "floor", buildingId: "c44c9aec-f8e4-46b3-9957-12ceba088994" },
  });
  const input = screen.getByLabelText("Number");
  const save = screen.getByRole("button", { name: "Save" });
  for (const value of ["", "1.5", "2147483648"]) {
    fireEvent.change(input, { target: { value } });
    expect(save.hasAttribute("disabled")).toBe(true);
  }
  for (const value of ["0", "-1"]) {
    fireEvent.change(input, { target: { value } });
    expect(save.hasAttribute("disabled")).toBe(false);
  }
  cleanup();
  mount("en", {
    target: {
      mode: "update",
      entity: "apartment",
      id: "c44c9aec-f8e4-46b3-9957-12ceba088994",
      expected: "Studio",
    },
  });
  expect((screen.getByLabelText("Number") as HTMLInputElement).type).toBe("text");
  expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
});
it.each(["structureStale", "structureUncertain"] as const)(
  "preserves drafts and requires explicit refresh after %s",
  (key) => {
    const p = mount("en", { error: key });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Draft" } });
    expect(screen.getByRole("alert").textContent).toContain(translate("en", key));
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: translate("en", "refreshManagement") }));
    expect(p.onReload).toHaveBeenCalledOnce();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Draft");
  },
);
it("blocks submission, cancellation and Escape while saving", () => {
  const p = mount("en", { busy: true });
  expect(screen.getByLabelText("Name").hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
  expect(p.onClose).not.toHaveBeenCalled();
  expect(p.onSave).not.toHaveBeenCalled();
});

it("saves an address change without requiring a name change", async () => {
  const p = mount("en", {
    target: {
      mode: "update",
      entity: "building",
      id: "c44c9aec-f8e4-46b3-9957-12ceba088994",
      expected: "A",
      address: "Old street",
    },
  });
  fireEvent.change(screen.getByLabelText("Building address"), {
    target: { value: "New street 10" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(p.onSave).toHaveBeenCalledExactlyOnceWith("A", "New street 10"));
});
