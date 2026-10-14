"use client";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { FamilyAvatar } from "@/components/FamilyAvatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { buildings } from "@/lib/mock-data";
export function JoinPreview() {
 const {t}=useI18n();const [family,setFamily]=useState("");const [name,setName]=useState("");const [building,setBuilding]=useState(buildings[0]);const [apt,setApt]=useState("1");const [submitted,setSubmitted]=useState(false);
 function submit(e:FormEvent){e.preventDefault();setSubmitted(true);}
 return <AppShell><h1 className="text-2xl font-bold">{t("joinTitle")}</h1><p className="mb-4 text-sm text-muted-foreground">{t("joinIntro")}</p>
 {submitted?<div role="status" className="rounded-3xl bg-card p-5 shadow-warm">{t("submitted")} — Demo: {t("saved")} {t("hidden")}</div>:<form onSubmit={submit} className="space-y-4">
 <section className="space-y-3 rounded-3xl bg-card p-4 shadow-warm"><label className="block">{t("building")}<select className="mt-2 h-11 w-full rounded-xl border border-input bg-card px-3" value={building} onChange={e=>setBuilding(e.target.value)}>{buildings.map(b=><option key={b}>{b}</option>)}</select></label><label className="block">{t("apartment")}<Input required type="number" min="1" value={apt} onChange={e=>setApt(e.target.value)}/></label></section>
 <section className="space-y-3 rounded-3xl bg-card p-4 shadow-warm"><FamilyAvatar name={family||"?"} size={64}/><label className="block">{t("familyName")}<Input required value={family} onChange={e=>setFamily(e.target.value)} maxLength={100}/></label><label className="block">{t("fullName")}<Input required value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></label></section>
 <Button className="h-14 w-full rounded-2xl" type="submit">{t("submit")}</Button></form>}</AppShell>;
}
