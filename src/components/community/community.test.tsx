// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nContext } from "../../lib/i18n/context";
import { directionFor, translate, type Lang } from "../../lib/i18n/dictionary";
import { VisibilitySelector } from "./VisibilitySelector";
import { MemberEditor, emptyMember } from "./MemberEditor";
import { MemberRow } from "./MemberRow";
import { ContactAction } from "./ContactAction";
import { DirectoryFilters } from "../directory/DirectoryFilters";
import { ApartmentMap } from "./ApartmentMap";
import { CommunityNavigation } from "./CommunityNavigation";
import { JoinRequestCard } from "./JoinRequestCard";
import { HouseholdPanel } from "./HouseholdPanel";
import { CommunityLoading, CommunitySkeleton } from "./CommunityLoading";
import { Button } from "../ui/button";
import type { ReactNode } from "react";
function locale(children: ReactNode, lang: Lang = "en") {
  return (
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}
afterEach(cleanup);
describe("community building blocks", () => {
  it.each(["he", "en", "ru"] as const)("localizes contact actions and privacy in %s", (lang) => {
    render(
      locale(
        <>
          <ContactAction kind="phone" value="0501234567" />
          <VisibilitySelector value="admins" onChange={() => {}} />
        </>,
        lang,
      ),
    );
    expect(screen.getByRole("link", { name: translate(lang, "call") }).getAttribute("href")).toBe(
      "tel:0501234567",
    );
    expect(
      screen.getByRole("radio", { name: translate(lang, "vis_managers") }).hasAttribute("checked"),
    ).toBe(true);
  });
  it("never renders hidden contact values or destinations", () => {
    const { container } = render(
      locale(<ContactAction kind="email" visible={false} value="secret@example.com" />),
    );
    expect(container.innerHTML).not.toContain("secret@example.com");
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("does not offer a forbidden complex audience and changes only through callbacks", () => {
    const change = vi.fn();
    render(locale(<VisibilitySelector allowComplex={false} value="admins" onChange={change} />));
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    fireEvent.click(screen.getByRole("radio", { name: translate("en", "vis_building") }));
    expect(change).toHaveBeenCalledWith("building");
  });
  it("resets both contact audiences to managers when a member becomes a child", () => {
    const change = vi.fn();
    render(
      locale(
        <MemberEditor
          value={{ ...emptyMember(), phone: { value: "0501234567", visibility: "complex" } }}
          onChange={change}
        />,
      ),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: translate("en", "child") }));
    expect(change.mock.calls[0][0]).toMatchObject({
      child: true,
      phone: { visibility: "admins" },
      email: { visibility: "admins" },
    });
    expect(emptyMember(true).phone.visibility).toBe("admins");
  });
  it("renders mixed script names and private child contacts without a hidden value", () => {
    const { container } = render(
      locale(
        <MemberRow
          member={{
            id: "1",
            name: "אורי Козлов",
            child: true,
            age: 9,
            contacts: [{ kind: "phone", visible: false }],
          }}
        />,
      ),
    );
    expect(container.querySelector("bdi")?.textContent).toBe("אורי Козлов");
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("filters locally and resets query, building and status", () => {
    render(
      locale(
        <DirectoryFilters
          entries={[
            { id: "1", name: "Cohen", building: "1", apartment: "12", status: "tenant" },
            { id: "2", name: "Леви", building: "2", apartment: "8", status: "owner-resident" },
          ]}
        />,
      ),
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Леви" } });
    expect(screen.queryByText("Cohen")).toBeNull();
    expect(screen.getByText("Леви")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Cohen")).toBeTruthy();
  });
  it("leaves controlled filter state to its owner", () => {
    const change = vi.fn();
    render(
      locale(
        <DirectoryFilters
          entries={[]}
          value={{ query: "", building: "", status: "" }}
          onChange={change}
        />,
      ),
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Cohen" } });
    expect(change).toHaveBeenCalledWith({ query: "Cohen", building: "", status: "" });
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });
  it("selects apartments by stable id and exposes selected state", () => {
    const select = vi.fn();
    render(
      locale(
        <ApartmentMap
          apartments={[{ id: "a", number: "12", floor: 1, status: "vacant" }]}
          selectedId="a"
          onSelect={select}
        />,
      ),
    );
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(select).toHaveBeenCalledWith("a");
  });
  it("keeps resident navigation to four items and excludes invitation links", () => {
    const { rerender } = render(
      locale(<CommunityNavigation active="directory" onChange={() => {}} />),
    );
    expect(screen.getAllByRole("button")).toHaveLength(4);
    rerender(locale(<CommunityNavigation manager active="directory" onChange={() => {}} />));
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });
  it("blocks approval and rejection while a request is busy", () => {
    const approve = vi.fn(),
      reject = vi.fn();
    render(
      locale(
        <JoinRequestCard
          busy
          request={{ id: "1", familyName: "Cohen", building: "1", apartment: "2" }}
          onApprove={approve}
          onReject={reject}
        />,
      ),
    );
    screen.getAllByRole("button").forEach((b) => {
      expect(b.hasAttribute("disabled")).toBe(true);
      fireEvent.click(b);
    });
    expect(approve).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });
  it("renders an accessible modal on compact viewports and closes with Escape", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    });
    Object.defineProperty(window, "innerWidth", { writable: true, value: 640 });
    const close = vi.fn();
    render(
      locale(
        <HouseholdPanel open onOpenChange={close}>
          <p>Cohen</p>
        </HouseholdPanel>,
      ),
    );
    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).toHaveBeenCalledWith(false);
  });
});

describe("loading states", () => {
  it("replaces content with localized non-interactive skeletons, then restores it", () => {
    const { rerender } = render(
      locale(
        <CommunityLoading loading variant="details">
          <p>Private content</p>
        </CommunityLoading>,
        "ru",
      ),
    );
    expect(screen.queryByText("Private content")).toBeNull();
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText(translate("ru", "loading"))).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(
      locale(
        <CommunityLoading loading={false} variant="details">
          <p>Private content</p>
        </CommunityLoading>,
        "ru",
      ),
    );
    expect(screen.getByText("Private content")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
  it.each([
    "household",
    "member",
    "birthday",
    "details",
    "map",
    "form",
    "navigation",
    "request",
    "directory",
  ] as const)("provides a %s skeleton without resident data", (variant) => {
    render(locale(<CommunitySkeleton variant={variant} />));
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
  });
  it("disables a busy button to prevent duplicate submissions", () => {
    const click = vi.fn();
    render(
      <Button loading onClick={click}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });
});
