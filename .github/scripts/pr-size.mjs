export const WEIGHTS = Object.freeze({ CODE: [1, 0.25], TEST: [0.5, 0.15], DOCS: [0.1, 0.1], IGNORED: [0, 0] });
export const SOFT_LIMIT = 400;
export const HARD_LIMIT = 800;
export const MARKER = '<!-- PR_SIZE_CHECK_BOT_COMMENT -->';

export function classifyFile(filename) {
  if (/(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$|\.min\.js$|\.gen\.|(^|\/)(dist|build)\//i.test(filename)) return 'IGNORED';
  if (/(^|\/)docs\/|\.(md|mdx|txt)$/i.test(filename)) return 'DOCS';
  if (/\.(test|spec)\.[jt]sx?$|(^|\/)__tests__\//i.test(filename)) return 'TEST';
  return 'CODE';
}

export function analyze(files) {
  const categories = Object.fromEntries(Object.keys(WEIGHTS).map(type => [type, { additions: 0, deletions: 0, effectiveLOC: 0 }]));
  const contributors = files.map(file => {
    // For renames, use the previous filename when both names have different classifications.
    const type = classifyFile(file.filename);
    const additions = file.additions ?? 0;
    const deletions = file.deletions ?? 0;
    const [addWeight, delWeight] = WEIGHTS[type];
    const effectiveLOC = additions * addWeight + deletions * delWeight;
    categories[type].additions += additions;
    categories[type].deletions += deletions;
    categories[type].effectiveLOC += effectiveLOC;
    return { filename: file.filename, type, additions, deletions, effectiveLOC };
  });
  const totalEffectiveLOC = Object.values(categories).reduce((sum, category) => sum + category.effectiveLOC, 0);
  return {
    totalEffectiveLOC,
    categories,
    topContributors: contributors.filter(file => file.effectiveLOC > 0)
      .sort((a, b) => b.effectiveLOC - a.effectiveLOC || a.filename.localeCompare(b.filename)).slice(0, 5),
    status: totalEffectiveLOC > HARD_LIMIT ? 'fail' : totalEffectiveLOC > SOFT_LIMIT ? 'warn' : 'pass',
  };
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
}

export function renderComment(report) {
  const { categories: c, topContributors: top, totalEffectiveLOC: total, status } = report;
  const verdict = status === 'fail' ? '🚨 PR exceeds the hard limit; split it before merging.'
    : status === 'warn' ? '⚠️ PR exceeds the soft limit; consider splitting it.'
    : '✅ PR size is within the recommended limit.';
  const categoryRows = Object.entries(WEIGHTS).map(([type, weights]) => {
    const item = c[type];
    return `| ${type} | +${item.additions} | -${item.deletions} | ${weights.join(' / ')} | **${Math.round(item.effectiveLOC)}** |`;
  }).join('\n');
  const topRows = top.map(f => `| \`${escapeCell(f.filename)}\` | ${f.type} | +${f.additions} / -${f.deletions} | **${Math.round(f.effectiveLOC)}** |`).join('\n');
  return `${MARKER}
### ${verdict}

**Effective LOC:** ${Math.round(total)} (soft: ${SOFT_LIMIT}, hard: ${HARD_LIMIT})

| Category | Added | Deleted | Weights (add/delete) | Effective LOC |
| --- | ---: | ---: | ---: | ---: |
${categoryRows}

#### Top contributors

| File | Category | Raw changes | Effective LOC |
| --- | --- | ---: | ---: |
${topRows || '| — | — | — | — |'}

> Only size is measured here; the future split advisor will provide context-aware suggestions.
`;
}
