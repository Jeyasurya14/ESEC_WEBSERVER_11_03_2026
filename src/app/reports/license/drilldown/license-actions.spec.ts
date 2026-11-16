import { describe, expect, it } from 'vitest';
import { licenseActions, LICENSE_ACTIONS } from './license-actions';

const labels = { divisionLabel: 'Business Unit', departmentLabel: 'Team' };

describe('License bottom action catalog', () => {
  it('matches all four company menus, including Group Date and Member before Hours', () => {
    expect(LICENSE_ACTIONS.organization).toEqual([
      'summary',
      'utilization',
      'history',
      'qos',
      'heatmap',
      'month',
      'date',
      'hours',
      'usage',
      'utilizationHours',
      'checkoutUser',
      'checkoutCount',
      'longDuration',
      'denial',
      'borrow',
      'division',
      'department',
      'reservation',
      'assetInfo',
      'debugData',
      'bundle',
    ]);
    const common = [
      'summary',
      'utilization',
      'heatmap',
      'hours',
      'usage',
      'utilizationHours',
      'checkoutUser',
      'checkoutCount',
      'longDuration',
      'denial',
      'borrow',
    ];
    expect(LICENSE_ACTIONS.department).toEqual(common);
    expect(LICENSE_ACTIONS.division).toEqual([...common, 'department']);
    expect(LICENSE_ACTIONS.group).toEqual([
      ...common.slice(0, 3),
      'date',
      'member',
      ...common.slice(3),
    ]);
  });

  it('uses configured organization labels in both scopes, with meaningful defaults', () => {
    expect(
      licenseActions('organization', labels, 1).find((action) => action.id === 'division')?.label,
    ).toBe('Business Unit');
    expect(licenseActions('division', labels, 1).at(-1)?.label).toBe('Team');
    expect(
      licenseActions('organization', { divisionLabel: '', departmentLabel: '' }, 1).find(
        (action) => action.id === 'department',
      )?.label,
    ).toBe('Department');
  });

  it('disables only Bundle when there are no loaded rows', () => {
    expect(
      licenseActions('organization', labels, 0)
        .filter((action) => action.disabled)
        .map((action) => action.id),
    ).toEqual(['bundle']);
    expect(licenseActions('organization', labels, 1).some((action) => action.disabled)).toBe(false);
  });
});
