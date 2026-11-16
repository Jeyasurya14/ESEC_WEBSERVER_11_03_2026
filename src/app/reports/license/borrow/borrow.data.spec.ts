import { describe, expect, it } from 'vitest';
import { borrowCall, borrowColumns } from './borrow.data';

describe('Borrow data rules', () => {
  it('calls the borrow procedure for a day range and feature group', () => {
    expect(borrowCall('john', { kind: 'days', days: 'YTD' }, 'Primary Feature')).toBe(
      "call esms_m.r_borrow_grid('john','YTD','Pri');",
    );
  });

  it('switches to the month/quarter/year procedure variants', () => {
    expect(borrowCall('john', { kind: 'month', month: 11, year: 2026 }, 'All Feature')).toBe(
      "call esms_m.r_borrow_grid_month_year('john','11','2026','All');",
    );
    expect(borrowCall('john', { kind: 'quarter', quarter: 4, year: 2026 }, 'All Feature')).toBe(
      "call esms_m.r_borrow_grid_qtr_year('john','4','2026','All');",
    );
    expect(borrowCall('john', { kind: 'year', year: 2026 }, 'All Feature')).toBe(
      "call esms_m.r_borrow_grid_year('john','2026','All');",
    );
  });

  it('groups the user id and name under one User header', () => {
    const userGroup = borrowColumns().find(
      (column) => 'children' in column && column.headerName === 'User',
    );
    expect(userGroup && 'children' in userGroup ? userGroup.children.length : 0).toBe(2);
  });
});
