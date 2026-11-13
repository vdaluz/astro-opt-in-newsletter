import assert from 'node:assert/strict';
import { it } from 'node:test';
import * as pkg from '../src/index.ts';

it('the barrel exports handleSubscribe and nothing browser-only', () => {
  assert.deepEqual(Object.keys(pkg).sort(), ['handleSubscribe']);
});
