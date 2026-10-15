"use client";
import { LockKeyhole, Building2, Users } from "lucide-react";
export type Visibility = "admins" | "building" | "complex";
export const visibilityOptions = [{ value: "admins", label: "מנהלים בלבד", Icon: LockKeyhole }, { value: "building", label: "הבניין שלי", Icon: Building2 }, { value: "complex", label: "כל המתחם", Icon: Users }] as const;
export function VisibilitySelector({ value, onChange, allowComplex = true, disabled = false, label = "מי יראה את הפרטים?" }: { value: Visibility; onChange: (value: Visibility) => void; allowComplex?: boolean; disabled?: boolean; label?: string }) {
 return <fieldset disabled={disabled} className="space-y-2"><legend className="mb-2 text-sm font-medium">{label}</legend><div className="grid grid-cols-3 gap-2">{visibilityOptions.filter(o => allowComplex || o.value !== "complex").map(({ value: option, label: text, Icon }) => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-xs focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${value === option ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"}`}><Icon aria-hidden="true" className="size-5"/>{text}</button>)}</div></fieldset>;
}
