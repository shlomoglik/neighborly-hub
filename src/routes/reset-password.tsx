import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "איפוס סיסמה – ספר השכנים" },
      { name: "description", content: "בחירת סיסמה חדשה" },
      { property: "og:title", content: "איפוס סיסמה – ספר השכנים" },
      { property: "og:description", content: "בחירת סיסמה חדשה" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    navigate({ to: "/directory" });
  }
  return (
    <div className="min-h-screen bg-hero px-5 py-16">
      <form onSubmit={save} className="mx-auto max-w-md space-y-4 rounded-3xl bg-card p-6 shadow-warm">
        <h1 className="text-2xl font-bold">{t("newPassword")}</h1>
        <Input type="password" dir="ltr" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button type="submit" className="h-12 w-full rounded-xl">{t("save")}</Button>
      </form>
    </div>
  );
}
