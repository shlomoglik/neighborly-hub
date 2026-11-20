// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nContext } from "@/lib/i18n/context";
import { directionFor, translate, type Lang } from "@/lib/i18n/dictionary";
import { ProductFeedback } from "./ProductFeedback";
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));
const fetchMock = vi.fn();
const uuid = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", { randomUUID: uuid });
  uuid.mockReturnValue("713f9ca1-ef37-47ce-9846-89ef06d65277");
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
function mount(lang: Lang = "en") {
  return render(
    <I18nContext.Provider
      value={{ lang, dir: directionFor(lang), setLang: () => {}, t: (key) => translate(lang, key) }}
    >
      <ProductFeedback />
    </I18nContext.Provider>,
  );
}
const textbox = () => screen.getByRole<HTMLTextAreaElement>("textbox");
function fill(message = "  Easier onboarding please  ") {
  fireEvent.change(textbox(), { target: { value: message } });
}
function submit() {
  fireEvent.submit(textbox().closest("form")!);
}
const saved = () => new Response(JSON.stringify({ id: "saved-record" }), { status: 200 });
it.each(["he", "en", "ru"] as const)("renders localized copy and direction in %s", (lang) => {
  mount(lang);
  expect(screen.getByRole("heading").textContent).toBe(translate(lang, "productFeedbackTitle"));
  expect(screen.getByText(translate(lang, "productFeedbackPrivacy"))).toBeTruthy();
  expect(textbox().closest("section")?.dir).toBe(directionFor(lang));
  expect(textbox().getAttribute("maxlength")).toBe("2000");
});
it("waits for API success, guards repeated submission, then uses a new UUID for new feedback", async () => {
  let finish!: (response: Response) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  mount();
  fill();
  submit();
  submit();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole<HTMLButtonElement>("button").disabled).toBe(true);
  expect(textbox().readOnly).toBe(true);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/product-feedback");
  expect(fetchMock.mock.calls[0][1]).toMatchObject({
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    submissionId: uuid.mock.results[0].value,
    message: "Easier onboarding please",
  });
  finish(saved());
  await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Send more feedback" }));
  expect(textbox().value).toBe("");
  uuid.mockReturnValue("19cdaf40-477e-42ed-a176-b617e1b669ef");
  fetchMock.mockResolvedValueOnce(saved());
  fill("Another idea");
  submit();
  await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).submissionId).not.toBe(
    JSON.parse(fetchMock.mock.calls[0][1].body).submissionId,
  );
});
it.each(["timeout", "server", "malformed-success"])(
  "retains text and exact request identity after %s and retries safely",
  async (failure) => {
    if (failure === "timeout")
      fetchMock.mockRejectedValueOnce(new DOMException("private detail", "TimeoutError"));
    else
      fetchMock.mockResolvedValueOnce(
        new Response(
          failure === "server" ? JSON.stringify({ error: "INTERNAL_ERROR" }) : "not json",
          { status: failure === "server" ? 500 : 200 },
        ),
      );
    mount();
    fill();
    submit();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByRole("status")).toBeNull();
    expect(textbox().value).toBe("  Easier onboarding please  ");
    expect(textbox().readOnly).toBe(true);
    expect(screen.queryByText("private detail")).toBeNull();
    fetchMock.mockResolvedValueOnce(saved());
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
    expect(uuid).toHaveBeenCalledTimes(1);
  },
);
it("keeps the draft when the session expires and offers sign-in without leaving the form", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401 }),
  );
  mount();
  fill();
  submit();
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByRole("link", { name: "Sign in in a new tab" }).getAttribute("target")).toBe(
    "_blank",
  );
  expect(textbox().value).toContain("Easier onboarding");
});
it.each(["   ", "a".repeat(2001), "bad\0text"])(
  "rejects invalid messages without sending",
  (message) => {
    mount();
    fill(message);
    submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(textbox().readOnly).toBe(false);
  },
);
