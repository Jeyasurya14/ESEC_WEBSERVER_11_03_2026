import { describe, expect, it } from 'vitest';
import { defaultLayout, detailGridRows, detailLinkFields } from './license-detail.utils';

describe('license detail helpers', () => {
  it('opens hours views split, chart views on the chart, and the rest on the grid', () => {
    expect(defaultLayout('hours')).toBe('split');
    expect(defaultLayout('utilizationHours')).toBe('split');
    expect(defaultLayout('debugData')).toBe('grid');
  });

  it('shows the rows unchanged when there is no matrix or grouping', () => {
    const rows = [{ user_id: 'u1' }];
    expect(detailGridRows(rows, 'denial', 'summary', '')).toBe(rows);
  });

  it('links the grouping column, else the column each view drills into', () => {
    expect(detailLinkFields('usage', 'divn')).toEqual(['divn']);
    expect(detailLinkFields('usage', '')).toEqual(['user_id']);
    expect(detailLinkFields('debugData', '')).toEqual(['lic']);
    expect(detailLinkFields('denial', '')).toEqual([]);
  });
});
