import { Badge } from "../ui/badge";
export type ResidentStatus = "owner-resident" | "owner-absent" | "tenant" | "pending" | "approved" | "rejected";
const labels: Record<ResidentStatus, string> = { "owner-resident": "בעלים ומתגוררים", "owner-absent": "בעלים · לא מתגוררים", tenant: "שוכרים", pending: "ממתין לאישור", approved: "מאושר", rejected: "נדחה" };
export function StatusBadge({ status }: { status: ResidentStatus }) { return <Badge variant={status === "rejected" ? "destructive" : status === "pending" ? "secondary" : "outline"}>{labels[status]}</Badge>; }
