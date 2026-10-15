import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";

if (!existsSync(".git")) process.exit(0);

let configured = "";
try {
  configured = execFileSync("git", ["config", "--local", "--get", "core.hooksPath"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  // No custom hooks path is configured.
}

if (configured && configured !== ".githooks") {
  console.log("Existing Git hooksPath preserved: " + configured);
  process.exit(0);
}

chmodSync(".githooks/pre-commit", 0o755);
execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"]);
console.log("Pre-commit Prettier hook installed");
