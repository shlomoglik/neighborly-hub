import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Visibility = "project" | "building" | "managers";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return null;
      const [roles, staff] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("staff").select("*").eq("user_id", user.id),
      ]);
      const isAdmin = (roles.data ?? []).some((r) => r.role === "admin");
      return { user, isAdmin, staff: staff.data ?? [], isStaff: isAdmin || (staff.data ?? []).length > 0 };
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useBuildings(projectId?: string) {
  return useQuery({
    queryKey: ["buildings", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from("buildings").select("*").eq("project_id", projectId!).order("name");
      if (error) throw error;
      return data;
    },
  });
}

export const HOUSEHOLD_SELECT =
  "*, apartments!inner(id, number, floor, buildings!inner(id, name, project_id)), contacts(*, contact_phones(*), contact_emails(*))";

export function toWhatsApp(num: string) {
  let d = num.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "972" + d.slice(1);
  return `https://wa.me/${d}`;
}

export function ageOf(birth: string, at = new Date()) {
  const b = new Date(birth);
  let a = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) a--;
  return a;
}

export function daysUntilBirthday(birth: string) {
  const b = new Date(birth);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  return { days: Math.round((next.getTime() - today.getTime()) / 86400000), turns: next.getFullYear() - b.getFullYear() };
}

export async function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const s = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.8);
}
