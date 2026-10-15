import type { Meta, StoryObj } from "@storybook/react-vite";
import { useI18n } from "@/lib/i18n/context";
import { useState } from "react";
import { DirectoryFilters, type DirectoryEntry } from "./DirectoryFilters";
function Example({ empty = false, many = false }: { empty?: boolean; many?: boolean }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<DirectoryEntry>();
  const entries = empty
    ? []
    : Array.from({ length: many ? 30 : 3 }, (_, i) => ({
        id: String(i),
        name: i % 2 ? t("demoFamilyTwo") : t("demoFamily"),
        building: String((i % 3) + 1),
        apartment: String(i + 1),
      }));
  return (
    <>
      <DirectoryFilters entries={entries} onSelect={setSelected} />
      {selected && (
        <p role="status">
          <bdi>{selected.name}</bdi>
        </p>
      )}
    </>
  );
}
const meta = {
  title: "Features/Directory/Filters",
  component: Example,
  tags: ["autodocs"],
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Empty: Story = { args: { empty: true } };
export const ManyEntries: Story = { args: { many: true } };
