"use client";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildings } from "@/lib/mock-data";
import { useI18n } from "@/lib/i18n";
export function ManagePreview() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [items, setItems] = useState(buildings);
  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t("manage")} — Demo</h1>
        <section className="rounded-3xl bg-card p-4 shadow-warm">
          <h2 className="font-bold">{t("pendingRequests")}</h2>
          <p className="text-sm text-muted-foreground">{t("noPending")}</p>
        </section>
        <section className="space-y-3 rounded-3xl bg-card p-4 shadow-warm">
          <h2 className="font-bold">{t("buildings")}</h2>
          {items.map((b) => (
            <div key={b} className="rounded-2xl bg-muted p-3">
              {b}
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) {
                setItems([...items, name.trim()]);
                setName("");
              }
            }}
            className="flex gap-2"
          >
            <Input
              required
              placeholder={t("name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit">{t("addBuilding")}</Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
