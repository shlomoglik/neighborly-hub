import { AlertCircle, LockKeyhole, SearchX, WifiOff } from "lucide-react";
import { Button } from "../ui/button";
export function SystemFeedback({ kind, message, onRetry }: { kind: "empty" | "error" | "offline" | "private"; message?: string; onRetry?: () => void }) {
 const Icon = { empty: SearchX, error: AlertCircle, offline: WifiOff, private: LockKeyhole }[kind];
 const defaults = { empty: "לא נמצאו תוצאות", error: "לא הצלחנו לטעון את הנתונים", offline: "מוצגים נתונים מהביקור הקודם", private: "הפרטים אינם גלויים לך" };
 return <div role={kind === "error" ? "alert" : "status"} className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center"><Icon className="size-6 text-muted-foreground"/><p>{message ?? defaults[kind]}</p>{onRetry && <Button variant="outline" onClick={onRetry}>נסו שוב</Button>}</div>;
}
