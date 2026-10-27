// @vitest-environment jsdom
import { Suspense, type ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate } from "@/lib/i18n/dictionary";
import { useManagement } from "./use-management";
import { ProjectManagementLayout } from "./ProjectManagementLayout";
const route = vi.hoisted(() => ({ pathname: "/manage/project/one" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("./use-management", () => ({ useManagement: vi.fn() }));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
afterEach(cleanup);
const project = {
  id: "one",
  name: "Urban Colony",
  city: "Sderot",
  counts: { buildings: 8, floors: 65, apartments: 253 },
  buildings: [],
  canAddBuilding: true,
};
function view(content: ReactNode) {
  return (
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      <ProjectManagementLayout>
        <Suspense fallback={<div>Loading tab</div>}>{content}</Suspense>
      </ProjectManagementLayout>
    </I18nContext.Provider>
  );
}
function LoadingTab(): ReactNode {
  throw new Promise(() => {});
}
function state(
  overrides: Partial<ReturnType<typeof useManagement>> = {},
): ReturnType<typeof useManagement> {
  return {
    key: "one",
    status: "ready",
    data: project,
    selectedProjectId: project.id,
    buildingIds: [],
    onBuildingChange: vi.fn(),
    onPageChange: vi.fn(),
    onRefresh: vi.fn(),
    onAccessLost: vi.fn(),
    discovery: {
      canCreateProject: true,
      projects: [],
      hasManagementAccess: true,
      page: 1,
      hasNext: false,
    },
    ...overrides,
  };
}
it("keeps the same project header mounted while each destination tab suspends", () => {
  vi.mocked(useManagement).mockReturnValue(state());
  route.pathname = "/manage/project/one";
  const rendered = render(view(<div>Structure content</div>));
  const heading = screen.getByRole("heading", { name: project.name });
  for (const section of ["staff", "invitations", "project"]) {
    route.pathname = `/manage/${section}/one`;
    rendered.rerender(view(<LoadingTab />));
    expect(screen.getByRole("heading", { name: project.name })).toBe(heading);
    expect(screen.getByText("Loading tab")).toBeTruthy();
    const tabs = screen.getByRole("navigation", { name: translate("en", "managementSections") });
    const label = translate(
      "en",
      section === "staff"
        ? "staffManagement"
        : section === "invitations"
          ? "managementInvitationsTab"
          : "editorTitle",
    );
    expect(within(tabs).getByRole("link", { name: label }).getAttribute("aria-current")).toBe(
      "page",
    );
    const breadcrumb = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(
      within(breadcrumb)
        .getByRole("link", { name: translate("en", "manage") })
        .getAttribute("href"),
    ).toBe("/manage");
    expect(within(breadcrumb).getByRole("link", { name: project.name }).getAttribute("href")).toBe(
      "/manage/project/one",
    );
    expect(within(breadcrumb).getByText(label).getAttribute("aria-current")).toBe("page");
  }
});
it("clears project metadata when authorization is lost", () => {
  vi.mocked(useManagement).mockReturnValue(state());
  const rendered = render(view(<div>Content</div>));
  expect(screen.getByRole("heading", { name: project.name })).toBeTruthy();
  vi.mocked(useManagement).mockReturnValue(
    state({ data: null, discovery: null, status: "unavailable" }),
  );
  rendered.rerender(view(<div>Access unavailable</div>));
  expect(screen.queryByRole("heading", { name: project.name })).toBeNull();
});
