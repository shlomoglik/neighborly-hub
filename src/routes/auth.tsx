import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Smartphone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "כניסה – ספר השכנים" },
      { name: "description", content: "כניסה והרשמה לספר השכנים" },
      { property: "og:title", content: "כניסה – ספר השכנים" },
      { property: "og:description", content: "כניסה והרשמה לספר השכנים" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function normalizePhone(p: string) {
  let d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("0")) d = "+972" + d.slice(1);
  if (!d.startsWith("+")) d = "+" + d;
  return d;
}

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/directory" });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/directory" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  const emailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/directory", data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) toast.success(t("checkEmail"));
      }
    });
  };

  const forgot = () =>
    run(async () => {
      if (!email) throw new Error(t("email") + " – " + t("required"));
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
      if (error) throw error;
      toast.success(t("resetSent"));
    });

  const sendCode = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalizePhone(phone) });
      if (error) throw error;
      setCodeSent(true);
      toast.success(t("codeSent"));
    });

  const verify = () =>
    run(async () => {
      const { error } = await supabase.auth.verifyOtp({ phone: normalizePhone(phone), token: code, type: "sms" });
      if (error) throw error;
    });

  const google = () =>
    run(async () => {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
      if (r.error) throw r.error;
    });

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold">🏡 {t("appName")}</span>
          <LangSwitcher />
        </div>
        <div className="mt-10 rounded-3xl bg-card p-6 shadow-warm">
          <Button variant="outline" className="h-12 w-full rounded-xl text-base" onClick={google} disabled={busy}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/></svg>
            {t("google")}
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {t("or")}
            <div className="h-px flex-1 bg-border" />
          </div>
          <Tabs defaultValue="email">
            <TabsList className="grid w-full grid-cols-2 rounded-xl">
              <TabsTrigger value="email" className="rounded-lg"><Mail className="h-4 w-4" /> {t("email")}</TabsTrigger>
              <TabsTrigger value="phone" className="rounded-lg"><Smartphone className="h-4 w-4" /> {t("phone")}</TabsTrigger>
            </TabsList>
            <TabsContent value="email">
              <form onSubmit={emailSubmit} className="mt-4 space-y-3">
                {mode === "up" && (
                  <div className="space-y-1.5">
                    <Label>{t("fullName")}</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>{t("email")}</Label>
                  <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("password")}</Label>
                  <Input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} />
                </div>
                <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={busy}>
                  {mode === "in" ? t("signIn") : t("signUp")}
                </Button>
                <div className="flex justify-between text-sm">
                  <button type="button" className="text-primary font-medium" onClick={() => setMode(mode === "in" ? "up" : "in")}>
                    {mode === "in" ? t("signUp") : t("signIn")}
                  </button>
                  {mode === "in" && (
                    <button type="button" className="text-muted-foreground" onClick={forgot}>{t("forgot")}</button>
                  )}
                </div>
              </form>
            </TabsContent>
            <TabsContent value="phone">
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label>{t("phone")}</Label>
                  <Input type="tel" dir="ltr" inputMode="tel" placeholder={t("phonePlaceholder")} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                </div>
                {codeSent && (
                  <Input dir="ltr" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="text-center text-lg tracking-widest" />
                )}
                <Button className="h-12 w-full rounded-xl text-base" disabled={busy || !phone} onClick={codeSent ? verify : sendCode}>
                  {codeSent ? t("verifyCode") : t("sendCode")}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
