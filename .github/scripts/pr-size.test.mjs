import test from "node:test";
import assert from "node:assert/strict";
import { analyze, classifyFile, renderComment } from "./pr-size.mjs";

test("classifies common file types", () => {
  assert.equal(classifyFile("docs/guide.ts"), "DOCS");
  assert.equal(classifyFile("src/a.test.tsx"), "TEST");
  assert.equal(classifyFile("src/__tests__/foo.ts"), "TEST");
  assert.equal(classifyFile("pnpm-lock.yaml"), "IGNORED");
  assert.equal(classifyFile("src/index.ts"), "CODE");
});
test("weights additions and deletions independently", () => {
  const report = analyze([
    { filename: "src/app.ts", additions: 100, deletions: 40 },
    { filename: "src/app.test.ts", additions: 20, deletions: 10 },
    { filename: "docs/readme.md", additions: 10, deletions: 10 },
    { filename: "pnpm-lock.yaml", additions: 1000, deletions: 1000 },
  ]);
  assert.equal(report.totalEffectiveLOC, 123.5);
  assert.equal(report.topContributors[0].effectiveLOC, 110);
  assert.match(renderComment(report), /Top contributors/);
});
test("thresholds are exclusive and retain precision", () => {
  assert.equal(analyze([{ filename: "a.ts", additions: 400 }]).status, "pass");
  assert.equal(analyze([{ filename: "a.ts", additions: 401 }]).status, "warn");
  assert.equal(analyze([{ filename: "a.ts", additions: 800 }]).status, "warn");
  assert.equal(analyze([{ filename: "a.ts", additions: 801 }]).status, "fail");
});
test("top five sorted by exact scores, ignores zero and breaks ties", () => {
  const files = Array.from({ length: 7 }, (_, i) => ({ filename: `f${i}.ts`, additions: i * 10 }));
  files.push({ filename: "lock/pnpm-lock.yaml", additions: 9999 });
  const report = analyze(files);
  assert.equal(report.topContributors.length, 5);
  assert.deepEqual(
    report.topContributors.map((f) => f.filename),
    ["f6.ts", "f5.ts", "f4.ts", "f3.ts", "f2.ts"],
  );
});

test("recognizes Node module tests and generated project output", () => {
  for (const filename of [
    ".github/scripts/pr-size.test.mjs",
    "scripts/a.spec.cjs",
    "src/a.test.mts",
  ]) {
    assert.equal(classifyFile(filename), "TEST");
  }
  for (const filename of [
    "storybook-static/index.html",
    ".next/server/app.js",
    "coverage/report.html",
  ]) {
    assert.equal(classifyFile(filename), "IGNORED");
  }
});

test("renames use the stricter category in either direction", () => {
  for (const [filename, previous_filename] of [
    ["docs/a.md", "src/a.ts"],
    ["src/a.ts", "docs/a.md"],
    ["dist/a.js", "src/a.ts"],
  ]) {
    const report = analyze([{ filename, previous_filename, additions: 10, deletions: 4 }]);
    assert.equal(report.totalEffectiveLOC, 11);
    assert.equal(report.categories.CODE.additions, 10);
  }
  assert.equal(
    analyze([{ filename: "src/b.ts", previous_filename: "src/a.ts", additions: 0, deletions: 0 }])
      .totalEffectiveLOC,
    0,
  );
});

test("fractional sums cannot cross the hard threshold through floating point error", () => {
  const files = Array.from({ length: 235 }, (_, i) => ({ filename: `docs/${i}.md`, additions: 1 }));
  // Direct floating point summation gives 800.0000000000001 here.
  files.push({ filename: "src/a.ts", deletions: 3106 });
  assert.equal(analyze(files).totalEffectiveLOC, 800);
  assert.equal(analyze(files).status, "warn");
  files.push({ filename: "src/a.test.ts", deletions: 1 });
  const report = analyze(files);
  assert.equal(report.status, "fail");
  assert.match(renderComment(report), /800\.15/);
});

test("tie order is deterministic and empty reports have a valid table", () => {
  assert.deepEqual(
    analyze([
      { filename: "b.ts", additions: 1 },
      { filename: "a.ts", additions: 1 },
    ]).topContributors.map((f) => f.filename),
    ["a.ts", "b.ts"],
  );
  assert.equal(analyze([]).status, "pass");
  assert.match(renderComment(analyze([])), /\| — \| — \| — \| — \| — \|/);
});

test("untrusted filenames remain literal and cannot inject table rows or mentions", () => {
  const body = renderComment(
    analyze([
      { filename: "src/`|\n<img src=x>@someone[link](https://example.com).ts", additions: 1 },
    ]),
  );
  assert.ok(!body.includes("<img"));
  assert.ok(!body.includes("@someone"));
  assert.ok(!body.includes("`|"));
  assert.match(body, /&#124;/);
  assert.match(body, /&#96;/);
});

test("aligns markers, changes and weights in addition/deletion order", () => {
  const body = renderComment(analyze([{ filename: "src/app.ts", additions: 188, deletions: 4 }]));
  assert.ok(body.includes("| Category | +- | Changes | Weights | LOC |"));
  assert.ok(body.includes("| CODE | 🟢<br>🔴 | +188<br>-4 | 1<br>0.25 | **189** |"));
  assert.ok(body.includes("| TEST | 🟢<br>🔴 | +0<br>-0 | 0.5<br>0.15 | **0** |"));
  assert.ok(body.includes("| File | Category | +- | Changes | LOC |"));
  assert.ok(body.includes("| CODE | 🟢<br>🔴 | +188<br>-4 | **189** |"));
});
