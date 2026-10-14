import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { FamilyAvatar } from "@/components/FamilyAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { fileToAvatarDataUrl, useBuildings, useProjects, type Visibility } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/join")({
  head: () => ({
    meta: [
      { title: "הצטרפות – ספר השכנים" },
      { name: "description", content: "טופס הצטרפות לספר השכנים" },
      { property: "og:title", content: "הצטרפות – ספר השכנים" },
      { property: "og:description", content: "טופס הצטרפות לספר השכנים" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Join,
});

type Member = { name: string; relation: string; birth: string; child: boolean; phone: string; vis: Visibility };
const sel = "h-11 w-full rounded-xl border border-input bg-card px-3";

function Join() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const [pid, setPid] = useState("");
  const [bid, setBid] = useState("");
  const [aid, setAid] = useState("");
  const { data: buildings } = useBuildings(pid || undefined);
  const { data: apts } = useQuery({
    queryKey: ["apts", bid],
    enabled: !!bid,
    queryFn: async () => (await supabase.from("apartments").select("*").eq("building_id", bid).order("number")).data ?? [],
  });
  const [family, setFamily] = useState("");
  const [ownership, setOwnership] = useState<"owner_resident" | "tenant" | "owner_non_resident">("owner_resident");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [primary, setPrimary] = useState<Member>({ name: "", relation: "", birth: "", child: false, phone: "", vis: "building" });
  const [phone2, setPhone2] = useState("");
  const [email, setEmail] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!aid || !family.trim() || !primary.name.trim()) { toast.error(t("required")); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: hh, error } = await supabase
        .from("households")
        .insert({ apartment_id: aid, display_name: family.trim().slice(0, 100), ownership, avatar_url: avatar, created_by: u.user!.id })
        .select()
        .single();
      if (error) throw error;
      const all = [{ ...primary, primary: true }, ...members.map((m) => ({ ...m, primary: false }))];
      for (const [i, m] of all.entries()) {
        if (!m.name.trim()) continue;
        const { data: c, error: ce } = await supabase
          .from("contacts")
          .insert({ household_id: hh.id, full_name: m.name.trim().slice(0, 100), relation: m.relation || null, is_primary: m.primary, is_child: m.child, birth_date: m.birth || null, sort: i })
          .select()
          .single();
        if (ce) throw ce;
        const phones = [m.phone, m.primary ? phone2 : ""].filter((p) => p.trim());
        for (const p of phones) await supabase.from("contact_phones").insert({ contact_id: c.id, number: p.trim().slice(0, 30), visibility: m.child ? "managers" : m.vis });
        if (m.primary && email.trim()) await supabase.from("contact_emails").insert({ contact_id: c.id, email: email.trim().slice(0, 255) });
      }
      toast.success(t("submitted"));
      navigate({ to: "/household/$id", params: { id: hh.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  const visSelect = (v: Visibility, on: (v: Visibility) => void) => (
    <select value={v} onChange={(e) => on(e.target.value as Visibility)} className={sel}>
      <option value="project">{t("vis_project")}</option>
      <option value="building">{t("vis_building")}</option>
      <option value="managers">{t("vis_managers")}</option>
    </select>
  );

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">{t("joinTitle")}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{t("joinIntro")}</p>
      <form onSubmit={submit} className="space-y-4">
        <section className="space-y-3 rounded-3xl bg-card p-4 shadow-warm">
          <Label>{t("project")}</Label>
          <select className={sel} value={pid} onChange={(e) => { setPid(e.target.value); setBid(""); setAid(""); }}>
            <option value="">{t("select")}</option>
            {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select className={sel} value={bid} onChange={(e) => { setBid(e.target.value); setAid(""); }} disabled={!pid}>
              <option value="">{t("building")}</option>
              {buildings?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className={sel} value={aid} onChange={(e) => setAid(e.target.value)} disabled={!bid}>
              <option value="">{t("apartment")}</option>
              {apts?.map((a) => <option key={a.id} value={a.id}>{a.number} ({t("floor")} {a.floor})</option>)}
            </select>
          </div>
        </section>
        <section className="space-y-3 rounded-3xl bg-card p-4 shadow-warm">
          <div className="flex items-center gap-3">
            <FamilyAvatar name={family || "?"} src={avatar} size={64} />
            <label className="cursor-pointer rounded-xl bg-secondary px-3 py-2 text-sm font-medium">
              {t("choosePhoto")}
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setAvatar(await fileToAvatarDataUrl(f)); }} />
            </label>
          </div>
          <Label>{t("familyName")}</Label>
          <Input value={family} onChange={(e) => setFamily(e.target.value)} maxLength={100} className="h-11 rounded-xl" />
          <Label>{t("ownershipQ")}</Label>
          <div className="grid gap-2">
            {(["owner_resident", "tenant", "owner_non_resident"] as const).map((o) => (
              <button type="button" key={o} onClick={() => setOwnership(o)} className={`rounded-xl border p-3 text-start font-medium ${ownership === o ? "border-primary bg-primary/10" : "border-border"}`}>{t(o)}</button>
            ))}
          </div>
        </section>
        <section className="space-y-3 rounded-3xl bg-card p-4 shadow-warm">
          <h2 className="font-bold">{t("primary")}</h2>
          <Input placeholder={t("fullName")} value={primary.name} onChange={(e) => setPrimary({ ...primary, name: e.target.value })} className="h-11 rounded-xl" maxLength={100} />
          <Label>{t("birthDate")}</Label>
          <Input type="date" value={primary.birth} onChange={(e) => setPrimary({ ...primary, birth: e.target.value })} className="h-11 rounded-xl" />
          <Input type="tel" dir="ltr" placeholder={t("phonePlaceholder")} value={primary.phone} onChange={(e) => setPrimary({ ...primary, phone: e.target.value })} className="h-11 rounded-xl" />
          <Input type="tel" dir="ltr" placeholder={`${t("phone")} 2`} value={phone2} onChange={(e) => setPhone2(e.target.value)} className="h-11 rounded-xl" />
          {visSelect(primary.vis, (v) => setPrimary({ ...primary, vis: v }))}
          <Input type="email" dir="ltr" placeholder={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
        </section>
        <section className="space-y-3 rounded-3xl bg-card p-4 shadow-warm">
          <h2 className="font-bold">{t("family")}</h2>
          {members.map((m, i) => {
            const up = (p: Partial<Member>) => setMembers(members.map((x, j) => (j === i ? { ...x, ...p } : x)));
            return (
              <div key={i} className="space-y-2 rounded-2xl bg-muted p-3">
                <Input placeholder={t("name")} value={m.name} onChange={(e) => up({ name: e.target.value })} className="h-11 rounded-xl bg-card" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder={t("relation")} value={m.relation} onChange={(e) => up({ relation: e.target.value })} className="h-11 rounded-xl bg-card" />
                  <Input type="date" value={m.birth} onChange={(e) => up({ birth: e.target.value })} className="h-11 rounded-xl bg-card" />
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={m.child} onChange={(e) => up({ child: e.target.checked })} /> {t("child")}</label>
                <Input type="tel" dir="ltr" placeholder={`${t("phone")} (${t("hidden")}?)`} value={m.phone} onChange={(e) => up({ phone: e.target.value })} className="h-11 rounded-xl bg-card" />
                {!m.child && visSelect(m.vis, (v) => up({ vis: v }))}
                <button type="button" className="text-sm text-destructive" onClick={() => setMembers(members.filter((_, j) => j !== i))}>{t("remove")}</button>
              </div>
            );
          })}
          <Button type="button" variant="secondary" className="w-full rounded-xl" onClick={() => setMembers([...members, { name: "", relation: "", birth: "", child: true, phone: "", vis: "managers" }])}>{t("addMember")}</Button>
        </section>
        <Button type="submit" disabled={busy} className="h-14 w-full rounded-2xl text-base shadow-warm">{t("submit")}</Button>
      </form>
    </AppShell>
  );
}
