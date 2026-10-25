import { analyze, MARKER, renderComment } from './pr-size.mjs';

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const prNumber = Number(process.env.PR_NUMBER);
if (!token || !repo || !Number.isSafeInteger(prNumber) || prNumber < 1) {
  throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY and PR_NUMBER are required');
}
const [owner, name] = repo.split('/');
const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
async function request(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}: ${(await response.text()).slice(0, 500)}`);
  return response.json();
}
async function listPages(path) {
  const items = [];
  for (let page = 1; ; page++) {
    const separator = path.includes('?') ? '&' : '?';
    const batch = await request(`${path}${separator}per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) break;
    if (page >= 30) throw new Error('GitHub pagination limit reached (3000 items)');
  }
  return items;
}
const files = await listPages(`/repos/${owner}/${name}/pulls/${prNumber}/files`);
const report = analyze(files);
const body = renderComment(report);
const comments = await listPages(`/repos/${owner}/${name}/issues/${prNumber}/comments`);
const previous = comments.find(c => c.user?.type === 'Bot' && c.body?.includes(MARKER));
const commentsPath = `/repos/${owner}/${name}/issues/${prNumber}/comments`;
await request(previous ? `/repos/${owner}/${name}/issues/comments/${previous.id}` : commentsPath, {
  method: previous ? 'PATCH' : 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ body }),
});
console.log(JSON.stringify(report, null, 2));
if (report.status === 'fail') {
  console.error(`PR Effective LOC ${Math.round(report.totalEffectiveLOC)} exceeds hard limit 800`);
  process.exitCode = 1;
}
