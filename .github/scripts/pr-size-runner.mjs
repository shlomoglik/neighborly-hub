import { pathToFileURL } from "node:url";
import { analyze, HARD_LIMIT, MARKER, renderComment } from "./pr-size.mjs";

export async function run({ env = process.env, fetchImpl = fetch, log = console.log } = {}) {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPOSITORY;
  const prNumber = Number(env.PR_NUMBER);
  if (
    !token ||
    !/^[\w.-]+\/[\w.-]+$/.test(repo ?? "") ||
    !Number.isSafeInteger(prNumber) ||
    prNumber < 1
  ) {
    throw new Error("Valid GITHUB_TOKEN, GITHUB_REPOSITORY and PR_NUMBER are required");
  }
  const root = `/repos/${repo}`;
  async function request(path, options = {}) {
    const response = await fetchImpl(`https://api.github.com${path}`, {
      ...options,
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers,
      },
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
    return response.json();
  }
  async function listPages(path, expectedCount = Infinity) {
    const items = [];
    for (let page = 1; page <= 100; page++) {
      const batch = await request(`${path}?per_page=100&page=${page}`);
      items.push(...batch);
      if (batch.length < 100 || items.length >= expectedCount) return items;
    }
    throw new Error("GitHub pagination limit reached; refusing an incomplete report");
  }
  const pullPath = `${root}/pulls/${prNumber}`;
  const pull = await request(pullPath);
  if (!Number.isSafeInteger(pull.changed_files) || pull.changed_files > 3000) {
    throw new Error("GitHub file list is limited to 3000 files; cannot measure this PR completely");
  }
  if (env.PR_HEAD_SHA && pull.head.sha !== env.PR_HEAD_SHA) {
    throw new Error("PR head changed; a newer workflow run must publish the report");
  }
  const files = await listPages(`${pullPath}/files`, pull.changed_files);
  if (files.length !== pull.changed_files) throw new Error("Incomplete PR file list");
  const report = analyze(files);
  const body = renderComment(report);
  const commentsPath = `${root}/issues/${prNumber}/comments`;
  const comments = await listPages(commentsPath);
  const previous = comments.find(
    (c) => c.user?.login === "github-actions[bot]" && c.body?.startsWith(MARKER),
  );
  const latest = await request(pullPath);
  if (latest.head.sha !== pull.head.sha || latest.base.sha !== pull.base.sha) {
    throw new Error("PR changed while measuring; refusing to publish a stale report");
  }
  await request(previous ? `${root}/issues/comments/${previous.id}` : commentsPath, {
    method: previous ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  // Filenames may contain workflow command syntax, so do not log untrusted text.
  log(`PR Effective LOC: ${report.totalEffectiveLOC}; status: ${report.status}`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await run();
  if (report.status === "fail") {
    console.error(`PR Effective LOC ${report.totalEffectiveLOC} exceeds hard limit ${HARD_LIMIT}`);
    process.exitCode = 1;
  }
}
