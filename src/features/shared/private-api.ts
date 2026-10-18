export class PrivateRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export async function privateRequest<T>(
  url: string,
  signal: AbortSignal,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    signal,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    let code = "INTERNAL_ERROR";
    try {
      const data = await response.json();
      if (typeof data.error === "string") code = data.error;
    } catch {
      /* Generic non-JSON failure. */
    }
    throw new PrivateRequestError(response.status, code);
  }
  return response.json() as Promise<T>;
}
