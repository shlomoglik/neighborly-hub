import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Cake, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FamilyAvatar } from "@/components/FamilyAvatar";
import { QuickActions } from "@/components/QuickActions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { HOUSEHOLD_SELECT, daysUntilBirthday, useBuildings, useProjects } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/directory")({
  head: () => ({
    meta: [
      { title: "שכנים – ספר השכנים" },
      { name: "description", content: "רשימת השכנים בבניין ובמתחם" },
      { property: "og:title", content: "שכנים – ספר השכנים" },
      { property: "og:description", content: "רשימת השכנים בבניין ובמתחם" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Directory,
});

export const ownershipTone: Record<string, string> = {
  owner_resident: "bg-accent text-accent-foreground",
  tenant: "bg-warning/40 text-warning-foreground",
  owner_non_resident: "bg-secondary text-secondary-foreground",
};

function Directory() {
  const { t } = useI18n();
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState<string>();
  const [buildingId, setBuildingId] = useState("all");
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!projectId && projects?.length) setProjectId(projects[0]!.id);
  }, [projects, projectId]);
  const { data: buildings } = useBuildings(projectId);

  const { data: households, isLoading } = useQuery({
    queryKey: ["households", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("households")
        .select(HOUSEHOLD_SELECT)
        .eq("apartments.buildings.project_id", projectId!)
        .eq("status", "approved");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const list = (households ?? []).filter((h) => buildingId === "all" || h.apartments.buildings.id === buildingId);
    const s = q.trim().toLowerCase();
    const res = s
      ? list.filter(
          (h) =>
            h.display_name.toLowerCase().includes(s) ||
            String(h.apartments.number) === s ||
            h.contacts.some((c) => c.full_name.toLowerCase().includes(s)),
        )
      : list;
    return res.sort((a, b) =>
      a.apartments.buildings.name.localeCompare(b.apartments.buildings.name, undefined, { numeric: true }) || a.apartments.number - b.apartments.number,
    );
  }, [households, buildingId, q]);

  const birthdays = useMemo(() => {
    const out: { name: string; family: string; hid: string; days: number; turns: number }[] = [];
    for (const h of households ?? []) {
      if (buildingId !== "all" && h.apartments.buildings.id !== buildingId) continue;
      for (const c of h.contacts) {
        if (!c.birth_date) continue;
        const d = daysUntilBirthday(c.birth_date);
        if (d.days <= 30) out.push({ name: c.full_name, family: h.display_name, hid: h.id, ...d });
      }
    }
    return out.sort((a, b) => a.days - b.days).slice(0, 8);
  }, [households, buildingId]);

  return (
    <AppShell>
      <div className="space-y-4">
        {projects && projects.length > 1 && (
          <Select value={projectId ?? ""} onValueChange={(v) => { setProjectId(v); setBuildingId("all"); }}>
            <SelectTrigger className="h-11 rounded-xl bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {projects?.length === 1 && <h1 className="text-2xl font-bold">{projects[0]!.name}</h1>}

        <section className="rounded-3xl bg-hero p-4 shadow-warm">
          <h2 className="mb-3 flex items-center gap-2 font-bold"><Cake className="h-5 w-5 text-primary" /> {t("birthdays")}</h2>
          {birthdays.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noBirthdays")}</p>
          ) : (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {birthdays.map((b, i) => (
                <Link key={i} to="/household/$id" params={{ id: b.hid }} className="min-w-36 shrink-0 rounded-2xl bg-card p-3">
                  <div className="text-2xl">🎂</div>
                  <div className="mt-1 font-semibold leading-tight">{b.name}</div>
                  <div className="text-xs text-muted-foreground">{b.family}</div>
                  <div className="mt-1 text-xs font-medium text-primary">
                    {b.days === 0 ? t("today") : t("inDays", { n: b.days })} · {t("turns", { n: b.turns })}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="h-11 rounded-xl bg-card ps-9" />
          </div>
          <Select value={buildingId} onValueChange={setBuildingId}>
            <SelectTrigger className="h-11 w-36 rounded-xl bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allBuildings")}</SelectItem>
              {buildings?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-muted-foreground">{t("loading")}</p>
        ) : (households ?? []).length === 0 ? (
          <div className="rounded-3xl bg-card p-8 text-center">
            <p className="text-muted-foreground">{t("emptyBook")}</p>
            <Link to="/join" className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-foreground">{t("join")}</Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">{t("noResults")}</p>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((h) => {
              const primary = h.contacts.find((c) => c.is_primary) ?? h.contacts[0];
              const phone = primary?.contact_phones[0]?.number;
              const email = primary?.contact_emails[0]?.email;
              return (
                <li key={h.id}>
                  <Link to="/household/$id" params={{ id: h.id }} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-warm">
                    <FamilyAvatar name={h.display_name} src={h.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{h.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.apartments.buildings.name} · {t("apartment")} {h.apartments.number} · {t("floor")} {h.apartments.floor}
                      </div>
                      <Badge variant="secondary" className={`mt-1 rounded-full border-0 text-[11px] ${ownershipTone[h.ownership]}`}>{t(h.ownership)}</Badge>
                    </div>
                    <QuickActions phone={phone} email={null} className="hidden xs:flex sm:flex" />
                    {!phone && email && <QuickActions email={email} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
