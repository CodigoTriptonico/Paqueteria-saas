import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'scripts/test-business-model.mjs'), 'utf8');

describe('business database integration harness', () => {
  it('tests tenant isolation, platform access, membership uniqueness and accounting signals', () => {
    assert.match(source, /set local role authenticated/);
    assert.match(source, /load_business_workspace/);
    assert.match(source, /archive_business_organization/);
    assert.match(source, /unbalanced_entries/);
    assert.match(source, /duplicate_operations/);
    assert.match(source, /savepoint authenticated_scope_/);
    assert.match(source, /rollback to savepoint/);
    assert.match(source, /rollback/);
  });
});
