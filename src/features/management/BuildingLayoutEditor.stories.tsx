import type { Meta, StoryObj } from "@storybook/react-vite";
import { BuildingLayoutEditor } from "./BuildingLayoutEditor";
const id = "11111111-1111-4111-8111-111111111111";
const meta = {
  title: "Management/Building layout",
  component: BuildingLayoutEditor,
  args: {
    data: {
      id,
      name: "Community",
      city: "Sderot",
      canAddBuilding: true,
      counts: { buildings: 2, floors: 6, apartments: 12 },
      buildings: ["A", "B"].map((name, i) => ({
        id: i ? "22222222-2222-4222-8222-222222222222" : id,
        name,
        version: "a".repeat(64),
        floors: [0, 1, 2].map((number) => ({
          id: `33333333-3333-4333-8333-33333333333${number}`,
          number,
          apartments: Array.from({ length: number ? 4 : 0 }, (_, j) => ({
            id: String(j),
            number: String(j + 1),
          })),
        })),
      })),
    },
    initialId: id,
    refreshing: false,
    onClose: () => {},
    onSaved: () => {},
    onReload: () => {},
    onAccessLost: () => {},
    save: async () => ({ added: 0, removed: 0 }),
  },
} satisfies Meta<typeof BuildingLayoutEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Refreshing: Story = { args: { refreshing: true } };
