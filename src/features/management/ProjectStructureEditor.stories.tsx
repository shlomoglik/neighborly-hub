import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProjectStructureEditor } from "./ProjectStructureEditor";
import type { DraftBuilding, UnitType } from "./project-structure-draft";
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
}: {
  typesOnly?: boolean;
  mode?: "view" | "edit" | "create";
}) {
  const [buildings, setBuildings] = useState(fixture);
  return (
    <ProjectStructureEditor
      mode={mode}
      buildings={buildings}
      onChange={setBuildings}
      projectName="פרויקט הגפן · שלב א׳"
      typesOnly={typesOnly}
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
