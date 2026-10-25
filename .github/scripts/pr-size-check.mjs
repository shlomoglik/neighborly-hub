import { calculate, markdown } from './calculate-loc.mjs';
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const pr = Number(process.env.PR_NUMBER);
if (!token || !repo || !pr) throw new Error('Missing GitHub context');
const [owner, name] = repo.split('/');
const api = async (path, options = {}) => {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...options.headers }
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
};
const base = `/repos/${owner}/${name}`;
const files = [];
for (let page = 1; ; page++) {
  const batch = await api(`${base}/pulls/${pr}/files?per_page=100&page=${page}`);
  files.push(...batch);
  if (batch.length < 100) break;
}
const result = calculate(files);
const marker = '<!-- PR_SIZE_CHECK_BOT_COMMENT -->';
const body = `${marker}\\n${markdown(result)}`;
let existing;
for (let page = 1; ; page++) {
  const batch = await api(`${base}/issues/${pr}/comments?per_page=100&page=${page}`);
  existing = batch.find(c => c.body?.includes(marker) && c.user?.type === 'Bot');
  if (existing || batch.length < 100) break;
}
if (existing) await api(`${base}/issues/comments/${existing.id}`, { method: 'PATCH', body: JSON.stringify({body}) });
else await api(`${base}/issues/${pr}/comments`, { method: 'POST', body: JSON.stringify({body}) });
console.log(JSON.stringify(result));
if (result.status === 'hard') process.exitCode = 1;
