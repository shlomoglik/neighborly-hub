import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, classifyFile, renderComment } from './pr-size.mjs';

test('classifies common file types', () => {
  assert.equal(classifyFile('docs/guide.ts'), 'DOCS');
  assert.equal(classifyFile('src/a.test.tsx'), 'TEST');
  assert.equal(classifyFile('src/__tests__/foo.ts'), 'TEST');
  assert.equal(classifyFile('pnpm-lock.yaml'), 'IGNORED');
  assert.equal(classifyFile('src/index.ts'), 'CODE');
});
test('weights additions and deletions independently', () => {
  const report = analyze([
    { filename: 'src/app.ts', additions: 100, deletions: 40 },
    { filename: 'src/app.test.ts', additions: 20, deletions: 10 },
    { filename: 'docs/readme.md', additions: 10, deletions: 10 },
    { filename: 'pnpm-lock.yaml', additions: 1000, deletions: 1000 },
  ]);
  assert.equal(report.totalEffectiveLOC, 123.5);
  assert.equal(report.topContributors[0].effectiveLOC, 110);
  assert.match(renderComment(report), /Top contributors/);
});
test('thresholds are exclusive and retain precision', () => {
  assert.equal(analyze([{ filename: 'a.ts', additions: 400 }]).status, 'pass');
  assert.equal(analyze([{ filename: 'a.ts', additions: 401 }]).status, 'warn');
  assert.equal(analyze([{ filename: 'a.ts', additions: 800 }]).status, 'warn');
  assert.equal(analyze([{ filename: 'a.ts', additions: 801 }]).status, 'fail');
});
test('top five sorted by exact scores, ignores zero and breaks ties', () => {
  const files = Array.from({ length: 7 }, (_, i) => ({ filename: `f${i}.ts`, additions: i * 10 }));
  files.push({ filename: 'lock/pnpm-lock.yaml', additions: 9999 });
  const report = analyze(files);
  assert.equal(report.topContributors.length, 5);
  assert.deepEqual(report.topContributors.map(f => f.filename), ['f6.ts', 'f5.ts', 'f4.ts', 'f3.ts', 'f2.ts']);
});
