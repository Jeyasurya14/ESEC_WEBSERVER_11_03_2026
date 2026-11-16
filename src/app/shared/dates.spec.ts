import { describe, expect, it } from 'vitest';
import { formatDate, formatSqlDate, parseDate } from './dates';

describe('calendar dates', () => {
  it('separates database dates from displayed dates without shifting local midnight', () => {
    const date = new Date(2026, 10, 15);
    expect(formatSqlDate(date)).toBe('2026-11-15');
    expect(formatDate(date)).toBe('15-Nov-2026');
  });
  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '31-Apr-2026'])(
    'rejects invalid date %s instead of rolling into another month',
    (value) => {
      expect(parseDate(value)).toBeNull();
    },
  );
  it('accepts leap days and both supported calendar formats', () => {
    expect(parseDate('2024-02-29')).toEqual(new Date(2024, 1, 29));
    expect(parseDate('29-Feb-2024')).toEqual(new Date(2024, 1, 29));
  });
});
