import { expect, userEvent, within } from "storybook/test";
import { translate, isLang } from "@/lib/i18n/dictionary";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useI18n } from "@/lib/i18n/context";
import type { DirectoryQuery } from "@/lib/access/contracts";
import { ResidentDirectory } from "./ResidentDirectory";
import type { DirectoryStatus } from "./use-directory";
function Example({ state = "ready", empty = false }: { state?: DirectoryStatus; empty?: boolean }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<DirectoryStatus | null>(null);
  const [selectedProjectId, setProject] = useState("one");
  const [query, setQuery] = useState<DirectoryQuery>({ query: "", buildingId: "", page: 1 });
  const projects = [
    { id: "one", name: t("demoProject"), buildings: [{ id: "a", name: t("demoBuilding") }] },
    { id: "two", name: t("demoFamilyTwo"), buildings: [{ id: "b", name: t("demoBuilding") }] },
  ];
  const residents = Array.from({ length: empty ? 0 : 8 }, (_, i) => ({
    personId: String(i),
    name: i % 2 ? t("demoPersonTwo") : t("demoPerson"),
    householdId: String(i),
    householdName: t("demoFamily"),
    buildingId: selectedProjectId === "one" ? "a" : "b",
    buildingName: t("demoBuilding"),
    apartment: String(i + 1),
    contacts: [{ kind: "email" as const, value: `neighbor${i}@example.test`, label: null }],
  })).filter(
    (r) =>
      (!query.buildingId || r.buildingId === query.buildingId) &&
      [r.name, r.householdName, r.apartment].some((v) => v.includes(query.query)),
  );
  const pageSize = 3;
  return (
    <ResidentDirectory
      status={status ?? state}
      projects={state === "unlinked" || state === "expired" ? [] : projects}
      selectedProjectId={selectedProjectId}
      query={query}
      data={{
        residents: residents.slice((query.page - 1) * pageSize, query.page * pageSize),
        page: query.page,
        hasNext: residents.length > query.page * pageSize,
      }}
      onProjectChange={(id) => {
        setProject(id);
        setQuery({ query: "", buildingId: "", page: 1 });
      }}
      onQueryChange={(value) => setQuery((q) => ({ ...q, query: value, page: 1 }))}
      onBuildingChange={(id) => setQuery((q) => ({ ...q, buildingId: id, page: 1 }))}
      onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
      onRefresh={() => {
        setStatus("loading");
        window.setTimeout(() => setStatus("ready"), 700);
      }}
    />
  );
}
const meta = {
  title: "Features/Directory/Resident directory",
  component: Example,
  tags: ["autodocs"],
  argTypes: {
    state: {
      control: "select",
      options: ["ready", "loading", "unlinked", "error", "expired", "forbidden"],
    },
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const lang = isLang(globals.locale) ? globals.locale : "he";
    await userEvent.click(canvas.getByRole("button", { name: translate(lang, "directoryNext") }));
    await expect(canvas.getByText(translate(lang, "directoryPage", { n: 2 }))).toBeVisible();
    await userEvent.type(canvas.getByRole("textbox"), "999");
    await expect(canvas.getByText(translate(lang, "noResults"))).toBeVisible();
    await userEvent.clear(canvas.getByRole("textbox"));
    await expect(canvas.getAllByRole("article")).toHaveLength(3);
  },
};
export const Loading: Story = { args: { state: "loading" } };
export const Empty: Story = { args: { empty: true } };
export const Unlinked: Story = { args: { state: "unlinked" } };
export const Error: Story = { args: { state: "error" } };
export const SessionExpired: Story = { args: { state: "expired" } };
export const AccessRevoked: Story = { args: { state: "forbidden" } };
