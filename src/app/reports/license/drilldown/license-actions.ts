import { literal } from '../../../core/utils/data';
import { ReportAction } from '../../../shared/report-action-bar/report-action-bar';
import { ReportSettings } from '../../../shared/report-settings.service';
import { LicenseScope } from '../grouped-reports';

const LABELS = literal({
  summary: 'Summary',
  utilization: 'Utilization',
  history: 'History',
  qos: 'QOS',
  heatmap: 'Heatmap',
  month: 'Month',
  date: 'Date',
  hours: 'Hours',
  usage: 'Usage',
  utilizationHours: 'Utilization and Hours',
  checkoutUser: 'Checkout User',
  checkoutCount: 'Checkout Count',
  longDuration: 'Long Duration',
  denial: 'Denial',
  borrow: 'Borrow',
  division: 'Division',
  department: 'Department',
  reservation: 'Reservation',
  assetInfo: 'Asset Info',
  debugData: 'Debug Data',
  bundle: 'Bundle',
  member: 'Member',
});

export type LicenseActionId = keyof typeof LABELS;

/** Source: each company License screen's treeData, including its scope-specific order. */
export const LICENSE_ACTIONS: Readonly<Record<LicenseScope, readonly LicenseActionId[]>> = {
  organization: [
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
  ],
  division: [
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
    'department',
  ],
  department: [
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
  ],
  group: [
    'summary',
    'utilization',
    'heatmap',
    'date',
    'member',
    'hours',
    'usage',
    'utilizationHours',
    'checkoutUser',
    'checkoutCount',
    'longDuration',
    'denial',
    'borrow',
  ],
};

export function licenseActions(
  scope: LicenseScope,
  settings: Pick<ReportSettings, 'divisionLabel' | 'departmentLabel'>,
  rowCount: number,
): readonly ReportAction<LicenseActionId>[] {
  return LICENSE_ACTIONS[scope].map((id) => ({
    id,
    label:
      id === 'division'
        ? settings.divisionLabel || LABELS.division
        : id === 'department'
          ? settings.departmentLabel || LABELS.department
          : LABELS[id],
    disabled: id === 'bundle' && rowCount === 0,
  }));
}
