"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { whatsappHref, emailHref } from "./sharing";
export function InvitationShare({
  url,
  projectName,
  email = "",
  contacts = [],
}: {
  url: string;
  projectName: string;
  email?: string;
  contacts?: { name: string; phone: string }[];
}) {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const message = t("inviteShareMessage", { project: projectName, url });
  const wa = whatsappHref(message, phone);
  useEffect(() => {
    let current = true;
    setQr("");
    setCopied(false);
    setFailed(false);
    void QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 4, width: 320 })
      .then((svg) => {
        if (current) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [url]);
  return (
    <section
      className="invitation-print space-y-4 rounded-2xl border bg-card p-4"
      aria-label={t("inviteShare")}
    >
      <h2 className="font-bold">{t("invitePrintTitle", { project: projectName })}</h2>
      <p>{t("invitePrintHint")}</p>
      {qr ? (
        <img
          src={qr}
          alt={t("inviteQrAlt")}
          width={320}
          height={320}
          className="mx-auto max-w-full bg-white"
        />
      ) : (
        <p role="status">{t(failed ? "loadError" : "loading")}</p>
      )}
      <a href={url} className="block break-all text-primary underline" dir="ltr">
        {url}
      </a>
      <div className="invitation-no-print space-y-3">
        <p>{t("inviteSecretOnce")}</p>
        {!!contacts.length && (
          <label className="block space-y-2">
            <span>{t("inviteKnownPhone")}</span>
            <select
              className="min-h-11 w-full rounded-xl border bg-card px-3"
              value=""
              onChange={(e) => setPhone(e.target.value)}
            >
              <option value="">{t("inviteSelectContact")}</option>
              {contacts.map((c, index) => (
                <option key={index} value={c.phone}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block space-y-2">
          <span>{t("invitePhone")}</span>
          <Input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <p className="text-sm text-muted-foreground">{t("invitePhoneHint")}</p>
        {phone && !wa && <p role="alert">{t("invitePhoneInvalid")}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setFailed(true);
              }
            }}
          >
            {t("inviteCopy")}
          </Button>
          <Button variant="outline" asChild>
            <a href={whatsappHref(message)!} target="_blank" rel="noopener noreferrer">
              {t("inviteWhatsApp")}
            </a>
          </Button>
          {phone && wa && (
            <Button variant="outline" asChild>
              <a href={wa} target="_blank" rel="noopener noreferrer">
                {t("inviteSendPhone")}
              </a>
            </Button>
          )}
          <Button variant="outline" asChild>
            <a href={emailHref(t("inviteEmailSubject", { project: projectName }), message, email)}>
              {t("inviteEmail")}
            </a>
          </Button>
          <Button variant="outline" disabled={!qr} onClick={() => window.print()}>
            {t("invitePrint")}
          </Button>
          {qr && (
            <Button variant="outline" asChild>
              <a href={qr} download="neighborly-invitation.svg">
                {t("inviteDownloadQr")}
              </a>
            </Button>
          )}
        </div>
        {copied && <p role="status">{t("inviteCopied")}</p>}
        {failed && <p role="alert">{t("inviteShareFailed")}</p>}
        <p className="text-sm text-muted-foreground">{t("inviteManualSend")}</p>
      </div>
    </section>
  );
}
