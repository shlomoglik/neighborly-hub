import { cn } from "@/lib/utils";

const tones = [
  "bg-primary/20 text-primary",
  "bg-accent text-accent-foreground",
  "bg-warning/40 text-warning-foreground",
  "bg-secondary text-secondary-foreground",
];

export function FamilyAvatar({
  name,
  src,
  size = 56,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const clean = name.replace(/^משפחת\s+/, "").trim();
  const initials = clean
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  const tone = tones[[...clean].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length];
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-2xl grid place-items-center font-bold",
        !src && tone,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials}
    </div>
  );
}
