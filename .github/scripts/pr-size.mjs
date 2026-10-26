export const WEIGHTS = Object.freeze({
  CODE: [1, 0.25],
  TEST: [0.5, 0.15],
  DOCS: [0.1, 0.1],
  IGNORED: [0, 0],
});
export const SOFT_LIMIT = 400;
export const HARD_LIMIT = 800;
export const MARKER = "<!-- PR_SIZE_CHECK_BOT_COMMENT -->";

export function classifyFile(filename) {
  if (
    /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$|\.min\.js$|\.gen\.|(^|\/)(dist|build|storybook-static|coverage|\.next)\//i.test(
      filename,
    )
  )
    return "IGNORED";
  if (/(^|\/)docs\/|\.(md|mdx|txt)$/i.test(filename)) return "DOCS";
  if (/\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)__tests__\//i.test(filename)) return "TEST";
  return "CODE";
}

export function analyze(files) {
  const categories = Object.fromEntries(
    Object.keys(WEIGHTS).map((type) => [type, { additions: 0, deletions: 0, effectiveLOC: 0 }]),
  );
  const contributors = files.map((file) => {
    // Renaming source into docs/generated paths must not discount edits in that PR.
    const currentType = classifyFile(file.filename);
    const previousType = file.previous_filename
      ? classifyFile(file.previous_filename)
      : currentType;
    const type = WEIGHTS[previousType][0] > WEIGHTS[currentType][0] ? previousType : currentType;
    const additions = file.additions ?? 0;
    const deletions = file.deletions ?? 0;
    const [addWeight, delWeight] = WEIGHTS[type];
    const effectiveLOC =
      (additions * Math.round(addWeight * 100) + deletions * Math.round(delWeight * 100)) / 100;
    categories[type].additions += additions;
    categories[type].deletions += deletions;
    categories[type].effectiveLOC =
      Math.round((categories[type].effectiveLOC + effectiveLOC) * 100) / 100;
    return { filename: file.filename, type, additions, deletions, effectiveLOC };
  });
  const totalEffectiveLOC =
    Object.values(categories).reduce(
      (sum, category) => sum + Math.round(category.effectiveLOC * 100),
      0,
    ) / 100;
  return {
    totalEffectiveLOC,
    categories,
    topContributors: contributors
      .filter((file) => file.effectiveLOC > 0)
      .sort((a, b) => b.effectiveLOC - a.effectiveLOC || a.filename.localeCompare(b.filename))
      .slice(0, 5),
    status:
      totalEffectiveLOC > HARD_LIMIT ? "fail" : totalEffectiveLOC > SOFT_LIMIT ? "warn" : "pass",
  };
}

function escapeCell(value) {
  // Numeric entities keep untrusted filenames literal in a Markdown table,
  // including backticks, pipes, HTML, links and mention syntax.
  return Array.from(String(value).slice(0, 300), (char) => `&#${char.codePointAt(0)};`).join("");
}

function formatLOC(value) {
  return String(Math.round(value * 100) / 100);
}

export function renderComment(report) {
  const { categories: c, topContributors: top, totalEffectiveLOC: total, status } = report;
  const verdict =
    status === "fail"
      ? "🚨 PR exceeds the hard limit; split it before merging."
      : status === "warn"
        ? "⚠️ PR exceeds the soft limit; consider splitting it."
        : "✅ PR size is within the recommended limit.";
  const categoryRows = Object.entries(WEIGHTS)
    .map(([type, weights]) => {
      const item = c[type];
      return `| ${type} | +${item.additions} | -${item.deletions} | ${weights.join(" / ")} | **${formatLOC(item.effectiveLOC)}** |`;
    })
    .join("\n");
  const topRows = top
    .map(
      (f) =>
        `| ${escapeCell(f.filename)} | ${f.type} | +${f.additions} / -${f.deletions} | **${formatLOC(f.effectiveLOC)}** |`,
    )
    .join("\n");
  return `${MARKER}
### ${verdict}

**Effective LOC:** ${formatLOC(total)} (soft: ${SOFT_LIMIT}, hard: ${HARD_LIMIT})

| Category | Added | Deleted | Weights (add/delete) | Effective LOC |
| --- | ---: | ---: | ---: | ---: |
${categoryRows}

#### Top contributors

| File | Category | Raw changes | Effective LOC |
| --- | --- | ---: | ---: |
${topRows || "| — | — | — | — |"}

> This measures changed lines, not complexity or correctness.
`;
}
