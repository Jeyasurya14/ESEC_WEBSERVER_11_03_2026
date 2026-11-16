import { hasKey } from '../../../core/utils/data';
import { literal } from '../../../core/utils/data';
import { organizationRow, reportSettings } from '../../../../testing/report-fixtures';
import { reflectComponentType } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { LicenseScope } from '../grouped-reports';

import { LICENSE_ACTIONS, LicenseActionId } from './license-actions';
import { LicenseDrilldownContext, loadLicenseDrilldown } from './license-drilldown-loader';

const row = organizationRow({
  server: 'srv',
  lic: 'CAD',
  divn: 'Engineering',
  dept: 'Design',
  g_type: 'Team',
  g_name: 'Alpha',
});
const context: LicenseDrilldownContext = {
  scope: 'organization',
  tile: { title: 'CAD', row, percent: 72, stats: [] },
  rows: [row],
  range: {
    startDate: new Date(2026, 10, 1),
    endDate: new Date(2026, 10, 15),
    workingDaysOnly: true,
  },
  settings: reportSettings({
    lowBelow: 60,
    highFrom: 80,
    heatmapColors: {},
    workingHoursPerDay: 7,
    divisionLabel: 'Division',
    departmentLabel: 'Department',
  }),
};

const selectors: Record<LicenseActionId, string> = {
  summary: 'app-license-summary',
  utilization: 'app-license-detail',
  history: 'app-license-detail',
  qos: 'app-license-detail',
  heatmap: 'app-license-detail',
  month: 'app-license-detail',
  date: 'app-license-detail',
  hours: 'app-license-detail',
  usage: 'app-license-detail',
  utilizationHours: 'app-license-detail',
  checkoutUser: 'app-license-detail',
  checkoutCount: 'app-license-detail',
  longDuration: 'app-license-detail',
  denial: 'app-license-detail',
  borrow: 'app-license-detail',
  division: 'app-division',
  department: 'app-license-department',
  reservation: 'app-license-group',
  assetInfo: 'app-license-detail',
  debugData: 'app-license-detail',
  bundle: 'app-license-bundle',
  member: 'app-group-details',
};

const routes = Object.keys(LICENSE_ACTIONS)
  .filter((scope): scope is LicenseScope => hasKey(LICENSE_ACTIONS, scope))
  .flatMap((scope) =>
    LICENSE_ACTIONS[scope].map((action): [LicenseScope, LicenseActionId] => [scope, action]),
  );

describe('License bottom report destinations', () => {
  it.each(routes)(
    'loads %s / %s with valid component input names and intact row identity',
    async (scope, action) => {
      const view = await loadLicenseDrilldown(action, { ...context, scope });
      expect(view).not.toBeNull();
      const component = reflectComponentType(view!.component)!;
      expect(component.selector).toBe(
        scope === 'organization' || action === 'summary' ? selectors[action] : 'app-group-details',
      );
      const inputNames = component.inputs.map((input) => input.propName);
      expect(Object.keys(view!.inputs).every((name) => inputNames.includes(name))).toBe(true);
      if (action === 'summary')
        expect(view!.inputs).toMatchObject({
          row,
          scope,
          settings: context.settings,
          title: 'CAD',
        });
      if (scope === 'organization' && ['division', 'department', 'reservation'].includes(action))
        expect(view!.inputs['parentRow']).toBe(row);
      else if (action !== 'summary' && action !== 'bundle') expect(view!.inputs['row']).toBe(row);
      if (scope !== 'organization' && action !== 'summary') {
        expect(view!.inputs['scope']).toBe(scope);
        expect(view!.inputs['view']).toBe(action);
        expect(view!.inputs['settings']).toBe(context.settings);
        expect(view!.inputs['range']).toBe(context.range);
      }
    },
  );

  it.each(literal(['heatmap', 'month', 'date', 'hours', 'checkoutUser', 'longDuration']))(
    'opens %s directly with one consistent settings and context contract',
    async (action) => {
      const view = await loadLicenseDrilldown(action, context);
      expect(view!.inputs).toEqual({
        view: action,
        row,
        range: context.range,
        settings: context.settings,
      });
    },
  );

  it.each<[LicenseScope, LicenseActionId]>([
    ['division', 'history'],
    ['department', 'department'],
    ['group', 'bundle'],
    ['organization', 'member'],
  ])('rejects unsupported %s / %s even when invoked outside the toolbar', async (scope, action) => {
    expect(await loadLicenseDrilldown(action, { ...context, scope })).toBeNull();
  });

  it('requires a selected row except for Bundle, which requires loaded rows', async () => {
    expect(await loadLicenseDrilldown('history', { ...context, tile: null })).toBeNull();
    expect(await loadLicenseDrilldown('bundle', { ...context, tile: null })).not.toBeNull();
    expect(await loadLicenseDrilldown('bundle', { ...context, rows: [] })).toBeNull();
  });
});
