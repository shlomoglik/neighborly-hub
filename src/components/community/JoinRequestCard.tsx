import { Button } from "../ui/button";
import { StatusBadge } from "./StatusBadge";
export type JoinRequest = { id: string; familyName: string; building: string; apartment: string; conflictWith?: string };
export function JoinRequestCard({ request, busy = false, onApprove, onReject }: { request: JoinRequest; busy?: boolean; onApprove: (id: string) => void; onReject: (id: string) => void }) {
 return <article className="space-y-3 rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{request.familyName}</h3><p className="text-sm text-muted-foreground">בניין {request.building} · דירה {request.apartment}</p></div><StatusBadge status="pending"/></div>{request.conflictWith && <p role="alert" className="rounded-lg bg-warning/15 p-3 text-sm">שימו לב: בדירה רשומה גם {request.conflictWith}. יש לבדוק לפני אישור.</p>}<div className="flex gap-2"><Button disabled={busy} onClick={() => onApprove(request.id)}>אישור</Button><Button disabled={busy} variant="outline" onClick={() => onReject(request.id)}>דחייה</Button></div></article>;
}
