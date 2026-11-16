import { describe, expect, it } from 'vitest';
import { defaultPeriod, licenseAgentCall, licenseAgentColumns } from './license-agent.data';

describe('License and Agent Combined data rules', () => {
  it('calls r_license_agent_sw with the software, period and working hours', () => {
    expect(licenseAgentCall('CATIA', new Date(2026, 9, 1), new Date(2026, 9, 30), 9)).toBe(
      "call esms_m.r_license_agent_sw('CATIA','2026-10-01','2026-10-30','9');",
    );
  });

  it('defaults to the last 30 days, today included', () => {
    const { startDate, endDate } = defaultPeriod(new Date(2026, 9, 30));
    expect(startDate).toEqual(new Date(2026, 9, 1));
    expect(endDate).toEqual(new Date(2026, 9, 30));
  });

  it('labels the division and department columns from the settings', () => {
    const userGroup = licenseAgentColumns('Divn', 'Dept').find(
      (column) => 'children' in column && column.headerName === 'User',
    );
    const headers =
      userGroup && 'children' in userGroup
        ? userGroup.children.map((column) => column.headerName)
        : [];
    expect(headers).toEqual(['User Id', 'User Name', 'Divn', 'Dept']);
  });

  it('pairs each hours column with its percentage', () => {
    const groups = licenseAgentColumns('Divn', 'Dept')
      .filter((column) => 'children' in column)
      .map((column) => column.headerName);
    expect(groups).toEqual(['User', 'Group', 'License Used', 'Work', 'Total']);
  });
});
