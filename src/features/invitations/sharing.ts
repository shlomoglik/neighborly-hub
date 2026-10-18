export function whatsappPhone(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;
  let digits = compact.replace(/^\+/, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "972" + digits.slice(1);
  return /^[1-9]\d{6,14}$/.test(digits) ? digits : null;
}
export function whatsappHref(message: string, phone?: string) {
  const digits = phone ? whatsappPhone(phone) : "";
  if (phone && !digits) return null;
  return `https://wa.me/${digits ?? ""}?text=${encodeURIComponent(message)}`;
}
export function emailHref(subject: string, body: string, email = "") {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
