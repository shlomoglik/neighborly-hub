# Application logging and user-facing errors

Application logs use [Pino](https://github.com/pinojs/pino) through `src/lib/logging.ts`. Use a static, dotted event name and diagnostic context:

```ts
logger.error("project.setup.failed", cause, { phase: "persist-project" });
logger.warn("structure.validation.failed", { indexBase: 0, issues });
```

Server events are JSON lines; browser events are console objects. Both include `service`, `event`, `level`, `time`, and `msg`. Browser layout validation warnings remain development-only. No remote log service or credentials are required.

The error helper extracts recognized SQLSTATE/connection codes through a bounded cause chain and adds a static diagnostic hint. It omits exception messages, stacks, SQL, parameters and row values. Context and warning fields must also be diagnostic only: never pass request bodies, headers, cookies, tokens, connection strings or resident information.

For example, a missing column produces `event: "project.setup.failed"`, `phase: "persist-project"`, and `error.code: "42703"`, with a migration hint. This record appears in the terminal running Next.js.

The setup API returns only allowlisted public error reasons. The client validates them and translates them through the existing Hebrew, English and Russian dictionary. Missing-schema errors explain that the service needs an update; connection errors suggest trying again shortly; uniqueness conflicts ask users to review their layout. Unknown reasons and non-JSON failures retain the generic localized message. Technical codes and private diagnostics stay out of the response. Failed submissions retain the wizard form.

Build/test/maintenance scripts retain their normal command-line progress output.
