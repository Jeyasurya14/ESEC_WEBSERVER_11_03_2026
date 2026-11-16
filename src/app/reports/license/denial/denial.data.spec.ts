import { describe, expect, it } from 'vitest';
import { denialCall, denialColumns } from './denial.data';

describe('Denial data rules', () => {
  it('calls the denial procedure for a day range and feature group', () => {
    expect(denialCall('john', { kind: 'days', days: '30' }, 'All Feature')).toBe(
      "call esms_m.r_denial_grid('john','30','All');",
    );
  });

  it('switches to the month/quarter/year procedure variants with their own arguments', () => {
    expect(denialCall('john', { kind: 'month', month: 3, year: 2026 }, 'Primary Feature')).toBe(
      "call esms_m.r_denial_grid_month_year('john','3','2026','Pri');",
    );
    expect(denialCall('john', { kind: 'quarter', quarter: 2, year: 2026 }, 'CATIA')).toBe(
      "call esms_m.r_denial_grid_qtr_year('john','2','2026','CATIA');",
    );
    expect(denialCall('john', { kind: 'year', year: 2025 }, 'All Feature')).toBe(
      "call esms_m.r_denial_grid_year('john','2025','All');",
    );
  });

  it('shows the denial-specific columns, hiding the same ones the company app hides', () => {
    const fields = denialColumns().map((column) => ('field' in column ? column.field : undefined));
    expect(fields).toContain('td');
    expect(fields).toContain('dd');

    const hidden = denialColumns()
      .filter((column) => 'hide' in column && column.hide)
      .map((column) => ('field' in column ? column.field : undefined));
    expect(hidden).toEqual(['location', 'lic', 'ad', 'start_date', 'bundle']);
  });
});
