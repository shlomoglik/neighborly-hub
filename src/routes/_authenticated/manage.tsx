import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { FamilyAvatar } from "@/components/FamilyAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { HOUSEHOLD_SELECT, useBuildings, useMe, useProjects } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/manage")({
  head: () => ({
    meta: [
      { title: "ניהול – ספר השכנים" },
      { name: "description", content: "ניהול פרויקטים, בניינים ואישור דיירים" },
      { property: "og:title", content: "ניהול – ספר השכנים" },
      { property: "og:description", content: "ניהול פרויקטים, בניינים ואישור דיירים" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Manage,
});

const card = "space-y-3 rounded-3xl bg-card p-4 shadow-warm";

function Manage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: projects } = useProjects();
  const [pid, setPid] = useState("");
  useEffect(() => { if (!pid && projects?.length) setPid(projects[0]!.id); }, [projects, pid]);
  const project = projects?.find((p) => p.id === pid);
  const { data: buildings } = useBuildings(pid || undefined);
  const isPM = !!me && (me.isAdmin || me.staff.some((s) => s.project_id === pid && s.role === "project_manager"));

  const { data: pending } = useQuery({
    queryKey: ["pending", pid],
    enabled: !!pid,
    queryFn: async () => {
      const { data, error } = await supabase.from("households").select(HOUSEHOLD_SELECT).eq("apartments.buildings.project_id", pid).eq("status", "pending");
      if (error) throw error;
      return data;
    },
  });

  const [bName, setBName] = useState("");
  const [floors, setFloors] = useState(6);
  const [units, setUnits] = useState(4);
  const [pName, setPName] = useState("");
  const [pCity, setPCity] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sRole, setSRole] = useState<"project_manager" | "building_manager">("building_manager");
  const [sBuilding, setSBuilding] = useState("");

  const wrap = async (p: PromiseLike<{ error: { message: string } | null }>, keys: string[]) => {
    const { error } = await p;
    if (error) return toast.error(error.message.includes("USER_NOT_FOUND") ? t("userNotFound") : error.message), false;
    toast.success(t("saved"));
    keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    return true;
  };

  if (me && !me.isStaff) return <AppShell><p className="py-10 text-center">{t("notManager")}</p></AppShell>;

  return (
    <AppShell>
      <div className="space-y-4">
        {projects && projects.length > 0 && (
          <select className="h-11 w-full rounded-xl border border-input bg-card px-3 font-semibold" value={pid} onChange={(e) => setPid(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        <section className={card}>
          <h2 className="font-bold">{t("pendingRequests")}</h2>
          {!pending?.length && <p className="text-sm text-muted-foreground">{t("noPending")}</p>}
          {pending?.map((h) => (
            <div key={h.id} className="flex items-center gap-3 rounded-2xl bg-muted p-3">
              <FamilyAvatar name={h.display_name} src={h.avatar_url} size={44} />
              <Link to="/household/$id" params={{ id: h.id }} className="min-w-0 flex-1">
                <div className="truncate font-semibold">{h.display_name}</div>
                <div className="text-xs text-muted-foreground">{h.apartments.buildings.name} · {t("apartment")} {h.apartments.number} · {t(h.ownership)}</div>
              </Link>
              <Button size="sm" className="rounded-full bg-success text-success-foreground" onClick={() => wrap(supabase.from("households").update({ status: "approved" }).eq("id", h.id), ["pending", "households"])}>{t("approve")}</Button>
              <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => wrap(supabase.from("households").update({ status: "rejected" }).eq("id", h.id), ["pending"])}>{t("reject")}</Button>
            </div>
          ))}
        </section>

        {isPM && project && (
          <section className={card}>
            <h2 className="font-bold">{t("visibility")}</h2>
            <div className="grid grid-cols-2 gap-2">
              {(["community", "building"] as const).map((v) => (
                <button key={v} onClick={() => wrap(supabase.from("projects").update({ visibility: v }).eq("id", pid), ["projects", "households"])}
                  className={`rounded-xl border p-3 text-sm font-medium ${project.visibility === v ? "border-primary bg-primary/10" : "border-border"}`}>
                  {v === "community" ? t("vis_community") : t("vis_building_only")}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className={card}>
          <h2 className="font-bold">{t("buildings")}</h2>
          <div className="grid grid-cols-2 gap-2">
            {buildings?.map((b) => (
              <div key={b.id} className="rounded-2xl bg-muted p-3">
                <div className="font-semibold">{b.name}</div>
                <div className="text-xs text-muted-foreground">{b.floors} {t("floors")} · {b.floors * b.units_per_floor} {t("units")}</div>
              </div>
            ))}
          </div>
          {isPM && (
            <form className="space-y-2 rounded-2xl border border-dashed border-border p-3" onSubmit={async (e) => {
              e.preventDefault();
              if (!bName.trim()) return;
              if (await wrap(supabase.from("buildings").insert({ project_id: pid, name: bName.trim(), floors, units_per_floor: units }), ["buildings"])) setBName("");
            }}>
              <div className="font-semibold">{t("addBuilding")}</div>
              <Input placeholder={t("name")} value={bName} onChange={(e) => setBName(e.target.value)} className="h-11 rounded-xl" />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">{t("floors")}<Input type="number" min={1} max={100} value={floors} onChange={(e) => setFloors(+e.target.value)} className="h-11 rounded-xl" /></label>
                <label className="text-xs">{t("unitsPerFloor")}<Input type="number" min={1} max={50} value={units} onChange={(e) => setUnits(+e.target.value)} className="h-11 rounded-xl" /></label>
              </div>
              <p className="text-xs text-muted-foreground">{t("willGenerate", { n: floors * units })}</p>
              <Button type="submit" className="w-full rounded-xl">{t("create")}</Button>
            </form>
          )}
        </section>

        {isPM && (
          <section className={card}>
            <h2 className="font-bold">{t("staff")}</h2>
            <Input type="email" dir="ltr" placeholder={t("email")} value={sEmail} onChange={(e) => setSEmail(e.target.value)} className="h-11 rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
              <select className="h-11 rounded-xl border border-input bg-card px-2" value={sRole} onChange={(e) => setSRole(e.target.value as typeof sRole)}>
                <option value="building_manager">{t("building_manager")}</option>
                <option value="project_manager">{t("project_manager")}</option>
              </select>
              <select className="h-11 rounded-xl border border-input bg-card px-2" value={sBuilding} onChange={(e) => setSBuilding(e.target.value)} disabled={sRole === "project_manager"}>
                <option value="">{t("building")}</option>
                {buildings?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <Button className="w-full rounded-xl" onClick={async () => {
              if (await wrap(supabase.rpc("assign_staff", { _email: sEmail, _project: pid, _building: (sRole === "building_manager" ? sBuilding : null) as string, _role: sRole }), ["me"])) setSEmail("");
            }}>{t("assign")}</Button>
          </section>
        )}

        {me?.isAdmin && (
          <section className={card}>
            <h2 className="font-bold">{t("newProject")} · <span className="text-xs text-muted-foreground">{t("admin")}</span></h2>
            <Input placeholder={t("projectName")} value={pName} onChange={(e) => setPName(e.target.value)} className="h-11 rounded-xl" />
            <Input placeholder={t("city")} value={pCity} onChange={(e) => setPCity(e.target.value)} className="h-11 rounded-xl" />
            <Button className="w-full rounded-xl" onClick={async () => {
              if (!pName.trim()) return;
              if (await wrap(supabase.from("projects").insert({ name: pName.trim(), city: pCity.trim() || null }), ["projects"])) { setPName(""); setPCity(""); }
            }}>{t("create")}</Button>
          </section>
        )}
      </div>
    </AppShell>
  );
}
