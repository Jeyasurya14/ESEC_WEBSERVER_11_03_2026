import { InjectionToken, Type } from '@angular/core';
import { ReportSettings } from '../../../shared/report-settings.service';
import { ReportRange } from '../../../shared/filters/range-filter';
import { LicenseScope } from '../grouped-reports';
import { GroupReportView } from '../group-details/group-queries';
import type { DetailView } from '../detail/detail-queries';
import { OrganizationRow, OrganizationTile } from '../organization/organization.data';
import { DrilldownRange } from './drilldown-range';
import { LICENSE_ACTIONS, LicenseActionId } from './license-actions';

export interface LicenseDrilldownContext {
  scope: LicenseScope;
  tile: OrganizationTile | null;
  rows: OrganizationRow[];
  range: DrilldownRange;
  settings: ReportSettings;
  reportRange?: ReportRange;
}

export interface LicenseDrilldownView {
  component: Type<unknown>;
  inputs: Record<string, unknown>;
}

export type LicenseDrilldownLoader = (
  action: LicenseActionId,
  context: LicenseDrilldownContext,
) => Promise<LicenseDrilldownView | null>;

// Explicit adapters prevent an Organization-only action being cast into an unsupported scoped view.
const SCOPED_VIEWS: Partial<Record<LicenseActionId, GroupReportView>> = {
  utilization: 'utilization',
  heatmap: 'heatmap',
  hours: 'hours',
  usage: 'usage',
  utilizationHours: 'utilizationHours',
  checkoutUser: 'checkoutUser',
  checkoutCount: 'checkoutCount',
  longDuration: 'longDuration',
  denial: 'denial',
  borrow: 'borrow',
  department: 'department',
  date: 'date',
  member: 'member',
};

// Detail reports share one workspace. Only the view id changes between destinations.
const DETAIL_REPORTS: Partial<Record<LicenseActionId, DetailView>> = {
  utilization: 'utilization',
  history: 'history',
  qos: 'qos',
  heatmap: 'heatmap',
  month: 'month',
  date: 'date',
  hours: 'hours',
  usage: 'usage',
  utilizationHours: 'utilizationHours',
  checkoutUser: 'checkoutUser',
  checkoutCount: 'checkoutCount',
  longDuration: 'longDuration',
  denial: 'denial',
  borrow: 'borrow',
  assetInfo: 'assetInfo',
  debugData: 'debugData',
};

const BREAKDOWN_REPORTS: Partial<
  Record<
    LicenseActionId,
    {
      label: string;
      load: () => Promise<Type<unknown>>;
    }
  >
> = {
  division: {
    label: 'Division',
    load: async () => (await import('../division/division')).Division,
  },
  department: {
    label: 'Department',
    load: async () => (await import('../department/department')).Department,
  },
  reservation: { label: 'Group', load: async () => (await import('../group/group')).Group },
};

export const loadLicenseDrilldown: LicenseDrilldownLoader = async (action, context) => {
  if (!LICENSE_ACTIONS[context.scope].includes(action)) return null;
  if (action === 'bundle') {
    if (!context.rows.length) return null;
    return {
      component: (await import('../bundle/license-bundle')).LicenseBundle,
      inputs: { rows: [...context.rows] },
    };
  }
  const tile = context.tile;
  if (!tile) return null;
  if (context.scope !== 'organization' && action !== 'summary') {
    const view = SCOPED_VIEWS[action];
    if (!view) return null;
    return {
      component: (await import('../group-details/group-details')).GroupDetails,
      inputs: {
        row: tile.row,
        scope: context.scope,
        view,
        range: context.range,
        settings: context.settings,
      },
    };
  }
  if (action === 'summary') {
    return {
      component: (await import('../summary/license-summary')).LicenseSummary,
      inputs: {
        row: tile.row,
        title: tile.title,
        scope: context.scope,
        settings: context.settings,
      },
    };
  }
  const breakdown = BREAKDOWN_REPORTS[action];
  if (breakdown) {
    return {
      component: await breakdown.load(),
      inputs: {
        parentRow: tile.row,
        initialRange: context.reportRange ?? { kind: 'days', days: '30' },
        menu: { mainMenuName: 'License', subMenuName: breakdown.label },
      },
    };
  }
  const view = DETAIL_REPORTS[action];
  if (!view) return null;
  return {
    component: (await import('../detail/license-detail')).LicenseDetail,
    inputs: { view, row: tile.row, range: context.range, settings: context.settings },
  };
};

export const LICENSE_DRILLDOWN_LOADER = new InjectionToken<LicenseDrilldownLoader>(
  'License drilldown loader',
  { providedIn: 'root', factory: () => loadLicenseDrilldown },
);
