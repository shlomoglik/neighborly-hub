export function splitFloorLabel(name: string, fallback: string) {
  const [title, ...description] = (name || fallback).split(/\s+-\s+/u);
  return { title, description: description.join(" - ") || null };
}
