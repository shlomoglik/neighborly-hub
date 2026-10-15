export type Visibility = "project" | "building" | "managers";
export type Contact = {
  name: string;
  relation: string;
  birthDate?: string;
  phone?: string;
  email?: string;
  visibility: Visibility;
};
export type Household = {
  id: string;
  name: string;
  building: string;
  apartment: number;
  floor: number;
  ownership: "owner_resident" | "tenant" | "owner_non_resident";
  contacts: Contact[];
};
export const buildings = ["בניין 1", "בניין 2"];
export const households: Household[] = [
  {
    id: "1",
    name: "משפחת כהן",
    building: "בניין 1",
    apartment: 12,
    floor: 3,
    ownership: "owner_resident",
    contacts: [
      { name: "דנה כהן", relation: "אמא", phone: "050-0000000", visibility: "building" },
      { name: "אורי כהן", relation: "ילד", visibility: "managers" },
    ],
  },
  {
    id: "2",
    name: "משפחת לוי",
    building: "בניין 1",
    apartment: 8,
    floor: 2,
    ownership: "tenant",
    contacts: [{ name: "יוסי לוי", relation: "אבא", visibility: "building" }],
  },
  {
    id: "3",
    name: "משפחת מזרחי",
    building: "בניין 2",
    apartment: 21,
    floor: 5,
    ownership: "owner_resident",
    contacts: [{ name: "נועה מזרחי", relation: "אמא", visibility: "building" }],
  },
];
export function toWhatsApp(num: string) {
  let d = num.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "972" + d.slice(1);
  return "https://wa.me/" + d;
}
