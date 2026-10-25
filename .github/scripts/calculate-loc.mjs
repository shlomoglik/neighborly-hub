export const WEIGHTS = { CODE: [1, 0.25], TEST: [0.5, 0.15], DOCS: [0.1, 0.1], IGNORED: [0, 0] };
export const SOFT_LIMIT = 400;
export const HARD_LIMIT = 800;
const ignored = [/pnpm-lock\\.yaml$/, /package-lock\\.json$/, /yarn\\.lock$/, /\\.min\\.js$/, /\\.gen\\./, /(^|\\/)dist\\//, /(^|\\/)build\\//, /(^|\\/)generated\\//];
const docs = [/\\.(md|mdx|txt)$/i, /(^|\\/)docs\\//];
const tests = [/\\.(test|spec)\\.[cm]?[jt]sx?$/, /(^|\\/)__tests__\\//, /(^|\\/)tests\\//];
export function classifyFile(path) {
  if (ignored.some(p => p.test(path))) return 'IGNORED';
  if (tests.some(p => p.test(path))) return 'TEST';
  if (docs.some(p => p.test(path))) return 'DOCS';
  return 'CODE';
}
export function calculate(files) {
  const breakdown = Object.fromEntries(Object.keys(WEIGHTS).map(k => [k, { additions: 0, deletions: 0, effective: 0 }]));
  const scores = files.map(file => {
    const type = classifyFile(file.filename);
    const additions = file.additions ?? 0, deletions = file.deletions ?? 0;
    const [addWeight, delWeight] = WEIGHTS[type];
    const effectiveLOC = additions * addWeight + deletions * delWeight;
    breakdown[type].additions += additions;
    breakdown[type].deletions += deletions;
    breakdown[type].effective += effectiveLOC;
    return { filename: file.filename, type, additions, deletions, effectiveLOC };
  });
  const total = scores.reduce((sum, file) => sum + file.effectiveLOC, 0);
  return { total, status: total > HARD_LIMIT ? 'hard' : total > SOFT_LIMIT ? 'soft' : 'ok', breakdown,
    topContributors: scores.filter(f => f.effectiveLOC > 0).sort((a,b) => b.effectiveLOC - a.effectiveLOC).slice(0,5) };
}
export function markdown(result) {
  const { total, status, breakdown, topContributors } = result;
  const icon = status === 'hard' ? '🚨' : status === 'soft' ? '⚠️' : '✅';
  const message = status === 'hard' ? 'PR exceeds the hard limit. Consider splitting it.' : status === 'soft' ? 'PR exceeds the soft limit. Consider splitting it.' : 'PR size is within the recommended range.';
  const rows = Object.entries(breakdown).map(([type, b]) => `| ${type} | +${b.additions} | -${b.deletions} | ${b.effective.toFixed(2)} |`).join('\\n');
  const top = topContributors.map(f => `| \`${f.filename.replaceAll('|', '&#124;').replaceAll('\\`', '&#96;')}\` | ${f.type} | +${f.additions} / -${f.deletions} | ${f.effectiveLOC.toFixed(2)} |`).join('\\n');
  return `### ${icon} PR Size Check (Effective LOC)\\n\\n${message}\\n\\n| Category | Additions | Deletions | Effective LOC |\\n|---|---:|---:|---:|\\n${rows}\\n| **Total** | | | **${total.toFixed(2)}** |\\n\\nSoft: ${SOFT_LIMIT} · Hard: ${HARD_LIMIT}\\n\\n#### Top 5 contributors\\n| File | Category | Raw changes | Effective LOC |\\n|---|---|---:|---:|\\n${top || '| — | — | — | — |'}\\n`;
}
