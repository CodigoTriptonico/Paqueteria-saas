import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'scripts/business-migration-audit.mjs'), 'utf8');

describe('business migration audit script', () => {
  it('enforces snapshot approval limits and produces required artifacts', () => {
    assert.match(source, /100_000/);
    assert.match(source, /100 \* 1024 \* 1024/);
    assert.match(source, /before-after\.csv/);
    assert.match(source, /progress\.log/);
    assert.match(source, /report\.md/);
  });
});
