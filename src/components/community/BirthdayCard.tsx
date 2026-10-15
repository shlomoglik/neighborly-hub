import { Button } from "../ui/button";
export function BirthdayCard({ name, when, age, onGreet }: { name: string; when: string; age?: number; onGreet?: () => void }) {
 return <article className="flex items-center gap-4 rounded-2xl border border-warning/40 bg-warning/10 p-4"><span aria-hidden="true" className="text-3xl">🎂</span><div className="flex-1"><h3 className="font-semibold">{name}</h3><p className="text-sm text-muted-foreground">{when}{age === undefined ? "" : ` · חוגג/ת ${age}`}</p></div>{onGreet && <Button variant="outline" onClick={onGreet}>ברכה</Button>}</article>;
}
