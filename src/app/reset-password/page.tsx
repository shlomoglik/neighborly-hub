"use client";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  function submit(e: FormEvent) {
    e.preventDefault();
    setDone(true);
  }
  return (
    <div className="min-h-screen bg-hero px-5 py-16">
      <form
        onSubmit={submit}
        className="mx-auto max-w-md space-y-4 rounded-3xl bg-card p-6 shadow-warm"
      >
        <h1 className="text-2xl font-bold">{t("newPassword")} — Demo</h1>
        <Input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit">{t("save")}</Button>
        {done && <p role="status">Demo only — password was not changed.</p>}
      </form>
    </div>
  );
}
