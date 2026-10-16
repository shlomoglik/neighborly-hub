/** Every management response, including failures, must be private and uncached. */
export function managementResponse(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
