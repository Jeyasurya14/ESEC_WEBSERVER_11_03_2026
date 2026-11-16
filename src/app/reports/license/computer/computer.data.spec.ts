import { describe, expect, it } from 'vitest';
import { computerCall, computerColumns } from './computer.data';

describe('License Computer data rules', () => {
  it('calls r_license_wksn for the signed-in user', () => {
    expect(computerCall('john')).toBe("call esms_m.r_license_wksn('john');");
  });

  it('shows the computer name and groups the access and denial columns', () => {
    const columns = computerColumns();
    expect(columns.some((column) => 'field' in column && column.field === 'wksn')).toBe(true);
    expect(
      columns.filter((column) => 'children' in column).map((column) => column.headerName),
    ).toEqual(['Access', 'Denial']);
  });
});
