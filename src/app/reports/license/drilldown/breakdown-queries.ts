import { sqlString } from '../../../core/api/api.service';
import { ReportRange } from '../../../shared/filters/range-filter';
import { OrganizationRow } from '../organization/organization.data';
import { LicenseScope } from '../grouped-reports';

/** Company breakdown procedures omit _grid before their calendar-range suffixes. */
export function organizationBreakdownCall(
  scope: LicenseScope,
  row: OrganizationRow,
  range: ReportRange,
): string {
  const reportGroup =
    scope === 'division' ? 'division' : scope === 'department' ? 'department' : 'group';
  let suffix: string;
  let values: string[];
  switch (range.kind) {
    case 'days':
      suffix = '_grid';
      values = [range.days];
      break;
    case 'month':
      suffix = '_month_year';
      values = [String(range.month), String(range.year)];
      break;
    case 'quarter':
      suffix = '_qtr_year';
      values = [String(range.quarter), String(range.year)];
      break;
    case 'year':
      suffix = '_year';
      values = [String(range.year)];
      break;
  }
  return `call esms_m.r_organization_groups_${reportGroup}${suffix}(${[row.server, row.lic, ...values].map(sqlString).join(',')});`;
}
