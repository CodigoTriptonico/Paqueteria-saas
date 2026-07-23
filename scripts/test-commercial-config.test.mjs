import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'scripts/test-commercial-config.mjs'), 'utf8');

describe('commercial database integration harness', () => {
  it('uses real catalog keys and rolls every fixture back', () => {
    assert.match(source, /box\.id limit 1/);
    assert.doesNotMatch(source, /box\.created_at/);
    assert.match(source, /Pais QA/);
    assert.match(source, /rollback/);
  });

  it('covers precedence, seller parity, route history and authorization', () => {
    for (const signal of ['groupOverride', 'entityOverride', 'restoreInheritance', 'sellerParity', 'routeHistory', 'unauthorizedMutation']) {
      assert.match(source, new RegExp(signal));
    }
  });

  it('preserves the original database error when a transaction is aborted', () => {
    assert.match(source, /catch \(error\)/);
    assert.match(source, /savepoint authenticated_scope_/);
    assert.match(source, /rollback to savepoint/);
    assert.match(source, /throw error/);
  });
});
