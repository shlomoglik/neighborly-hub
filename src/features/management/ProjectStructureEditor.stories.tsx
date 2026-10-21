import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProjectStructureEditor } from "./ProjectStructureEditor";
import type { DraftBuilding, UnitType } from "./project-structure-draft";
import { StructureEditor } from "./StructureEditor";
function fixture(): DraftBuilding[] {
  const floor = (
    id: string,
    number: number,
    name: string,
    type: UnitType,
    names: string[],
    linked: string[] = [],
  ) => ({
    id,
    number,
    name,
    type,
    apartments: names.map((number, i) => ({
      id: `${id}-${i}`,
      number,
      type,
      linked: linked.includes(number),
    })),
  });
  return [
    {
      id: "A",
      name: "בניין A · מגדל מגורים",
      address: "רחוב הגפן 1",
      floors: [
        floor("a4", 4, "פנטהאוז", "residential", ["PH-1", "PH-2"], ["PH-1"]),
        floor("a3", 3, "קומה 3", "residential", ["301", "302", "303", "304"], ["302"]),
        floor("a2", 2, "קומה 2", "residential", ["201", "202", "203", "204"]),
        floor("a1", 1, "קומה 1", "residential", ["25A", "25B", "25C", "Studio-X"]),
        floor("a0", 0, "קומת קרקע · מסחר", "commercial", []),
        floor(
          "ap",
          -1,
          "חניון 1-",
          "parking",
          Array.from({ length: 8 }, (_, i) => `P-0${i + 1}`),
        ),
      ],
    },
    {
      id: "B",
      name: "בניין B · מסחרי",
      address: "רחוב הגפן 3",
      floors: [
        floor("b2", 2, "משרדים", "commercial", ["Office-A", "Office-B"]),
        floor("b0", 0, "חנויות", "commercial", ["Shop-A", "Shop-B"]),
        floor("bp", -1, "חניון", "parking", []),
      ],
    },
    {
      id: "C",
      name: "בניין C · בוטיק",
      address: "רחוב הגפן 5",
      floors: [
        floor("c1", 1, "קומה 1", "residential", ["1", "2", "3"]),
        floor("c0", 0, "קרקע", "residential", ["4", "5"]),
      ],
    },
  ];
}
function Interactive({
  typesOnly = false,
  mode = "create",
  allBuildings = false,
}: {
  typesOnly?: boolean;
  mode?: "view" | "edit" | "create";
  allBuildings?: boolean;
}) {
  const [buildings, setBuildings] = useState(fixture);
  const [buildingIds, setBuildingIds] = useState<string[]>(allBuildings ? [] : ["A"]);
  return (
    <ProjectStructureEditor
      mode={mode}
      buildings={buildings.filter(
        (building) => !buildingIds.length || buildingIds.includes(building.id),
      )}
      onChange={setBuildings}
      projectName="פרויקט הגפן · שלב א׳"
      typesOnly={typesOnly}
      buildingOptions={buildings}
      selectedBuildingIds={buildingIds}
      onBuildingSelectionChange={setBuildingIds}
    />
  );
}

function SingleBuildingView() {
  const [buildings, setBuildings] = useState<DraftBuilding[]>(() => [
    {
      id: "dense",
      name: "אלון",
      address: "אלי כהן 5",
      floors: Array.from({ length: 9 }, (_, index) => {
        const number = 8 - index;
        const units = number === 0 ? 5 : 3;
        return {
          id: `dense-${number}`,
          number,
          name: `קומה ${number}`,
          type: "residential" as const,
          apartments: Array.from({ length: units }, (_, unit) => ({
            id: `dense-${number}-${unit}`,
            number: `${number}${String(unit + 1).padStart(2, "0")}`,
            type: unit === 0 && number === 0 ? ("commercial" as const) : ("residential" as const),
            linked: number === 8 && unit === 0,
          })),
        };
      }),
    },
  ]);
  return (
    <ProjectStructureEditor
      mode="view"
      buildings={buildings}
      onChange={setBuildings}
      projectName="המושבה העירונית"
      buildingOptions={buildings}
      selectedBuildingIds={["dense"]}
      onBuildingSelectionChange={() => {}}
    />
  );
}

function MixedFloorTypes() {
  const buildings: DraftBuilding[] = [
    {
      id: "mixed",
      name: "בניין תאנה - C2",
      address: "אלי כהן 7",
      floors: [
        { id: "f2", number: 2, name: "קומה 2", type: "residential", apartments: [] },
        {
          id: "f1",
          number: 1,
          name: "קומה 1 - קהילה ומסחר",
          type: "commercial",
          apartments: [{ id: "shop", number: "C-1", type: "commercial" }],
        },
        {
          id: "f0",
          number: 0,
          name: "קומה 0 - חנייה וכניסה",
          type: "parking",
          apartments: [{ id: "park", number: "P-1", type: "parking" }],
        },
      ],
    },
  ];
  return (
    <ProjectStructureEditor
      mode="view"
      buildings={buildings}
      onChange={() => {}}
      projectName="המושבה העירונית"
      buildingOptions={buildings}
      selectedBuildingIds={["mixed"]}
      onBuildingSelectionChange={() => {}}
    />
  );
}
const meta = {
  title: "Features/Management/Visual Structure",
  component: Interactive,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Interactive>;
export default meta;
type Story = StoryObj<typeof meta>;
export const EdgeCases: Story = {};
export const Types: Story = { args: { typesOnly: true } };

export const View: Story = { args: { mode: "view" } };
export const Edit: Story = { args: { mode: "edit" } };
export const ViewSingleBuilding: StoryObj<typeof SingleBuildingView> = {
  render: () => <SingleBuildingView />,
};
export const ViewAllBuildings: Story = { args: { mode: "view", allBuildings: true } };
export const ViewMobile: Story = {
  args: { mode: "view", allBuildings: true },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export const ViewMixedFloorTypes: StoryObj<typeof MixedFloorTypes> = {
  render: () => <MixedFloorTypes />,
};
const hierarchyError = (error: "structureDuplicate" | "structureStale" | "structureUncertain") => (
  <StructureEditor
    target={{ mode: "create", entity: "building" }}
    busy={false}
    error={error}
    onSave={async () => {}}
    onClose={() => {}}
    onReload={() => {}}
  />
);
export const Duplicate: Story = { render: () => hierarchyError("structureDuplicate") };
export const Stale: Story = { render: () => hierarchyError("structureStale") };
export const Uncertain: Story = { render: () => hierarchyError("structureUncertain") };
