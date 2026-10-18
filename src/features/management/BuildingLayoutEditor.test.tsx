// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BuildingLayoutEditor } from "./BuildingLayoutEditor";
import { I18nContext } from "@/lib/i18n/context";
import { translate, type Lang, directionFor } from "@/lib/i18n/dictionary";
import { PrivateRequestError } from "@/features/shared/private-api";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const f = "33333333-3333-4333-8333-333333333333",
  g = "44444444-4444-4444-8444-444444444444";
const data = {
  id: a,
  name: "Project",
  city: null,
  canAddBuilding: true,
  counts: { buildings: 2, floors: 2, apartments: 3 },
  buildings: [
    {
      id: a,
      name: "A",
      version: "a".repeat(64),
      floors: [{ id: f, number: 0, apartments: [{ id: a, number: "1" }] }],
    },
    {
      id: b,
      name: "B",
      version: "b".repeat(64),
      floors: [
        {
          id: g,
          number: 0,
          apartments: [
            { id: a, number: "1" },
            { id: b, number: "2" },
          ],
        },
      ],
    },
  ],
};
afterEach(cleanup);
function mount(lang: Lang = "en", save = vi.fn().mockResolvedValue({ added: 1, removed: 0 })) {
  const onSaved = vi.fn(),
    onReload = vi.fn(),
    onAccessLost = vi.fn();
  render(
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <BuildingLayoutEditor
        data={data}
        initialId={a}
        refreshing={false}
        onClose={vi.fn()}
        onSaved={onSaved}
        onReload={onReload}
        onAccessLost={onAccessLost}
        save={save}
      />
    </I18nContext.Provider>,
  );
  return { save, onSaved, onReload, onAccessLost };
}
it.each(["he", "en", "ru"] as const)(
  "reviews multiple buildings before submitting per-floor counts in %s",
  async (lang) => {
    const p = mount(lang);
    fireEvent.click(screen.getByRole("checkbox", { name: "B" }));
    expect(
      (screen.getByLabelText(translate(lang, "layoutFloor", { floor: 0 })) as HTMLInputElement)
        .placeholder,
    ).toBe(translate(lang, "layoutMixed"));
    fireEvent.change(screen.getByLabelText(translate(lang, "layoutFloor", { floor: 0 })), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "stepReview") }));
    expect(p.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "save") }));
    await waitFor(() => expect(p.onSaved).toHaveBeenCalledOnce());
    expect(p.save.mock.calls[0][1]).toEqual({
      buildings: [
        { id: a, expectedVersion: "a".repeat(64), floors: [{ id: f, units: 3 }] },
        { id: b, expectedVersion: "b".repeat(64), floors: [{ id: g, units: 3 }] },
      ],
    });
  },
);
it("leaves unselected buildings unchanged and requires refresh after a linked-apartment conflict", async () => {
  const p = mount(
    "en",
    vi.fn().mockRejectedValue(new PrivateRequestError(409, "LINKED_APARTMENTS")),
  );
  fireEvent.change(screen.getByLabelText("Apartments on floor 0"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: translate("en", "stepReview") }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(p.save.mock.calls[0][1].buildings).toHaveLength(1);
  expect(p.onSaved).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: translate("en", "refreshManagement") }));
  expect(p.onReload).toHaveBeenCalledOnce();
});
