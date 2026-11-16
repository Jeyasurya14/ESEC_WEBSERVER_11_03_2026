import { describe, expect, it } from 'vitest';
import { toggled } from './data';

describe('toggled', () => {
  it('adds a missing value and removes a present one, without changing the original', () => {
    const original = new Set(['a']);

    expect(toggled(original, 'b')).toEqual(new Set(['a', 'b']));
    expect(toggled(original, 'a')).toEqual(new Set());
    expect(original).toEqual(new Set(['a']));
  });
});
