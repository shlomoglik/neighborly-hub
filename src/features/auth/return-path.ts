export function authReturnPath(value: unknown) {
  return typeof value === "string" && /^\/join(?:\/[a-f0-9]{64})?$/.test(value)
    ? value
    : "/directory";
}
