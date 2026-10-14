import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cake, MessageCircle, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "@/components/LangSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ספר השכנים – Neighbors Book" },
      { name: "description", content: "ספר שכנים קהילתי: אנשי קשר, ימי הולדת ואישור דיירים לבניינים ופרויקטים עירוניים." },
      { property: "og:title", content: "ספר השכנים – Neighbors Book" },
      { property: "og:description", content: "ספר שכנים קהילתי לבניינים ומתחמים – בעברית, אנגלית ורוסית." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useI18n();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);
  const feats = [
    { icon: MessageCircle, text: t("feat1") },
    { icon: Cake, text: t("feat2") },
    { icon: ShieldCheck, text: t("feat3") },
  ];
  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-xl text-primary-foreground shadow-warm">🏡</span>
          <LangSwitcher />
        </div>
        <div className="mt-16 flex-1">
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight">{t("appName")}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t("tagline")}</p>
          <ul className="mt-10 space-y-3">
            {feats.map((f, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl bg-card/80 p-4 shadow-warm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </span>
                <span className="font-medium">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <Button asChild size="lg" className="mt-10 h-14 rounded-2xl text-base shadow-warm">
          {signedIn ? <Link to="/directory">{t("openBook")}</Link> : <Link to="/auth">{t("getStarted")}</Link>}
        </Button>
      </div>
    </div>
  );
}
