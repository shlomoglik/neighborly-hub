import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FamilyAvatar } from "@/components/FamilyAvatar";
import { QuickActions } from "@/components/QuickActions";
import { useI18n } from "@/lib/i18n";
import { HOUSEHOLD_SELECT, ageOf, type Visibility } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/household/$id")({
  head: () => ({
    meta: [
      { title: "כרטיס משפחה – ספר השכנים" },
      { name: "description", content: "פרטי קשר של משפחה בבניין" },
      { property: "og:title", content: "כרטיס משפחה – ספר השכנים" },
      { property: "og:description", content: "פרטי קשר של משפחה בבניין" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HouseholdPage,
});

function HouseholdPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: h, isLoading } = useQuery({
    queryKey: ["household", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("households").select(HOUSEHOLD_SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: canEdit } = useQuery({
    queryKey: ["canEdit", id],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (h?.created_by === u.user?.id) return true;
      const { data } = await supabase.rpc("can_manage_household", { _uid: u.user!.id, _hh: id });
      return !!data;
    },
    enabled: !!h,
  });

  async function setVis(phoneId: string, v: Visibility) {
    await supabase.from("contact_phones").update({ visibility: v }).eq("id", phoneId);
    qc.invalidateQueries({ queryKey: ["household", id] });
  }

  if (isLoading) return <AppShell><p className="py-10 text-center">{t("loading")}</p></AppShell>;
  if (!h) return <AppShell><p className="py-10 text-center">{t("noResults")}</p></AppShell>;
  const contacts = [...h.contacts].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort - b.sort);

  return (
    <AppShell>
      <Link to="/directory" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowRight className="h-4 w-4 ltr:rotate-180" /> {t("back")}
      </Link>
      <div className="rounded-3xl bg-hero p-5 text-center shadow-warm">
        <FamilyAvatar name={h.display_name} src={h.avatar_url} size={96} className="mx-auto" />
        <h1 className="mt-3 text-2xl font-bold">{h.display_name}</h1>
        <p className="text-sm text-muted-foreground">
          {h.apartments.buildings.name} · {t("apartment")} {h.apartments.number} · {t("floor")} {h.apartments.floor}
        </p>
        <span className="mt-2 inline-block rounded-full bg-card px-3 py-1 text-xs font-medium">{t(h.ownership)}</span>
        {h.status !== "approved" && <span className="ms-2 inline-block rounded-full bg-warning px-3 py-1 text-xs">{t(h.status)}</span>}
      </div>
      <h2 className="mb-2 mt-5 font-bold">{t("family")}</h2>
      <ul className="space-y-2.5">
        {contacts.map((c) => (
          <li key={c.id} className="rounded-2xl bg-card p-4 shadow-warm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{c.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.is_primary ? t("primary") : c.relation || (c.is_child ? t("child") : "")}
                  {c.birth_date && ` · ${t("age", { n: ageOf(c.birth_date) })}`}
                </div>
              </div>
              <QuickActions phone={c.contact_phones[0]?.number} email={c.contact_emails[0]?.email} />
            </div>
            {(c.contact_phones.length > 0 || c.contact_emails.length > 0) && (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                {c.contact_phones.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <a href={`tel:${p.number}`} dir="ltr" className="font-medium">{p.number}</a>
                    {canEdit ? (
                      <select value={p.visibility} onChange={(e) => setVis(p.id, e.target.value as Visibility)} className="rounded-lg bg-secondary px-2 py-1 text-xs">
                        <option value="project">{t("vis_project")}</option>
                        <option value="building">{t("vis_building")}</option>
                        <option value="managers">{t("vis_managers")}</option>
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground">{p.label}</span>
                    )}
                  </div>
                ))}
                {c.contact_emails.map((e) => (
                  <a key={e.id} href={`mailto:${e.email}`} dir="ltr" className="block text-muted-foreground">{e.email}</a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
