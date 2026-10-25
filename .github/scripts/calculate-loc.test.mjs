import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, classifyFile } from './calculate-loc.mjs';
test('classifies docs, tests and lockfiles', () => {
  assert.equal(classifyFile('docs/readme.md'), 'DOCS');
  assert.equal(classifyFile('src/foo.test.ts'), 'TEST');
  assert.equal(classifyFile('pnpm-lock.yaml'), 'IGNORED');
});
test('weights additions and deletions independently', () => {
  const r = calculate([{filename:'src/a.ts', additions:100, deletions:100}, {filename:'src/a.test.ts', additions:10, deletions:10}, {filename:'README.md', additions:10, deletions:10}]);
  assert.equal(r.total, 133.5);
});
test('top five excludes ignored and sorts by unrounded scores', () => {
  const files = Array.from({length:7}, (_,i)=>({filename:`src/${i}.ts`, additions:i+1, deletions:0}));
  files.push({filename:'pnpm-lock.yaml', additions:9999, deletions:0});
  const r=calculate(files);
  assert.equal(r.topContributors.length,5);
  assert.equal(r.topContributors[0].filename,'src/6.ts');
});
test('limits are strictly greater than thresholds', () => {
  assert.equal(calculate([{filename:'a.ts',additions:400,deletions:0}]).status,'ok');
  assert.equal(calculate([{filename:'a.ts',additions:401,deletions:0}]).status,'soft');
  assert.equal(calculate([{filename:'a.ts',additions:800,deletions:0}]).status,'soft');
  assert.equal(calculate([{filename:'a.ts',additions:801,deletions:0}]).status,'hard');
});
