import https from "node:https";
import http from "node:http";
import { readFileSync } from "node:fs";

// Only a loopback CI bridge. Never exposes a test login or listens on a public interface.
const origin = new URL(process.env.BETTER_AUTH_URL ?? "");
if (origin.protocol !== "https:" || origin.hostname !== "127.0.0.1" || origin.port !== "3443")
  throw new Error("Pilot proxy requires https://127.0.0.1:3443");
const proxy = https.createServer(
  {
    key: readFileSync(process.env.PILOT_TLS_KEY),
    cert: readFileSync(process.env.PILOT_TLS_CERT),
  },
  (request, response) => {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path: request.url,
        method: request.method,
        headers: {
          ...request.headers,
          host: origin.host,
          "x-forwarded-host": origin.host,
          "x-forwarded-proto": "https",
        },
      },
      (result) => {
        response.writeHead(result.statusCode ?? 502, result.headers);
        result.pipe(response);
      },
    );
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.on("aborted", () => upstream.destroy());
    request.pipe(upstream);
  },
);
proxy.listen(3443, "127.0.0.1", () => process.stdout.write("Pilot HTTPS bridge ready\n"));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => proxy.close());
