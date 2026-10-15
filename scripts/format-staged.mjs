import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const supported = /\.(?:ts|tsx|js|jsx|mjs|cjs|css|json|md)$/i;
const staged = readFileSync(0).toString("utf8").split("\0").filter(Boolean);
const files = staged.filter((file) => supported.test(file));

if (files.length === 0) process.exit(0);

const unstaged = new Set(
  execFileSync("git", ["diff", "--name-only", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean),
);
const partiallyStaged = files.filter((file) => unstaged.has(file));
if (partiallyStaged.length > 0) {
  console.error(
    "Prettier hook: these files have unstaged changes. Stage or stash them before committing:\n" +
      partiallyStaged.join("\n"),
  );
  process.exit(1);
}

const prettier = spawnSync("pnpm", ["exec", "prettier", "--write", "--ignore-unknown", ...files], {
  stdio: "inherit",
});
if (prettier.error || prettier.status !== 0) {
  console.error(prettier.error ?? "Prettier failed");
  process.exit(1);
}
execFileSync("git", ["add", "--", ...files], { stdio: "inherit" });
