"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LangSwitcher } from "@/components/LangSwitcher";
import { useI18n } from "@/lib/i18n";
export default function AuthPage(){
 const {t}=useI18n();const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [notice,setNotice]=useState(false);
 function submit(e:FormEvent){e.preventDefault();setNotice(true);}
 return <div className="min-h-screen bg-hero px-5 py-8"><div className="mx-auto max-w-md"><div className="flex items-center justify-between"><h1 className="text-xl font-bold">🏡 {t("appName")}</h1><LangSwitcher/></div><form onSubmit={submit} className="mt-10 space-y-4 rounded-3xl bg-card p-6 shadow-warm"><h2 className="text-lg font-bold">{t("signIn")} — Demo</h2><label className="block">{t("email")}<Input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block">{t("password")}<Input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><Button className="w-full" type="submit">{t("signIn")}</Button>{notice&&<p role="status">{t("hidden")} — Demo: authentication not connected.</p>}<Link href="/directory" className="block text-center text-primary">{t("openBook")}</Link><Link href="/reset-password" className="block text-center text-sm">{t("forgot")}</Link></form></div></div>;
}
