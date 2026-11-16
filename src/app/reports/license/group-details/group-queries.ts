import { sqlString } from '../../../core/api/api.service';
import { OrganizationRow } from '../organization/organization.data';
import { serverDate } from '../report-helpers';
import { LicenseScope } from '../grouped-reports';

export type GroupReportView =
  | 'utilization'
  | 'heatmap'
  | 'hours'
  | 'usage'
  | 'utilizationHours'
  | 'checkoutUser'
  | 'checkoutCount'
  | 'longDuration'
  | 'denial'
  | 'borrow'
  | 'department'
  | 'date'
  | 'member';
export interface GroupReportRequest {
  row: OrganizationRow;
  scope: Exclude<LicenseScope, 'organization'>;
  view: GroupReportView;
  start: string;
  end: string;
  startTime: string;
  endTime: string;
  workingHours: number;
  workingDays: boolean;
  granularity: 'date' | 'week' | 'month' | 'qtr' | 'year';
}

/** Procedure names and argument order mirror the source app's scoped reports. */
export function groupReportCall(request: GroupReportRequest): string {
  const { row, scope, view } = request;
  const identity =
    scope === 'division'
      ? [row.server, row.lic, row.divn ?? '']
      : scope === 'department'
        ? [row.server, row.lic, row.divn ?? '', row.dept ?? '']
        : [row.server, row.lic, row.g_type ?? '', row.g_name ?? ''];
  const dates = [serverDate(request.start), serverDate(request.end)];
  let procedure: string;
  let queryArgs: string[];
  switch (view) {
    case 'utilization':
      procedure = `${scope}_utilization_${request.granularity}`;
      queryArgs = [...identity, ...dates, request.startTime, request.endTime];
      break;
    case 'heatmap':
      procedure = `${scope}_utilization_hour`;
      queryArgs = [...identity, ...dates];
      break;
    case 'hours':
      procedure = `${scope}_usage_${request.granularity === 'month' ? 'month' : 'date'}`;
      queryArgs = [
        ...identity,
        ...dates,
        String(request.workingHours),
        ...(request.granularity === 'month' ? [request.workingDays ? 'N' : 'Y'] : []),
      ];
      break;
    case 'usage':
      procedure = `${scope}_usage`;
      queryArgs =
        scope === 'group'
          ? [...identity, ...dates, request.workingDays ? '' : 'Y']
          : [
              row.server,
              'All',
              row.divn ?? '',
              ...(scope === 'department' ? [row.dept ?? ''] : []),
              ...dates,
              request.workingDays ? '' : 'Y',
            ];
      break;
    case 'utilizationHours':
      procedure = `${scope}_usage_utilization_date_1`;
      queryArgs = [...identity, ...dates, 'W', request.workingDays ? 'N' : 'Y'];
      break;
    case 'checkoutUser':
      procedure = `${scope}_users_checkout_list_date`;
      queryArgs = [...identity, ...dates];
      break;
    case 'checkoutCount':
      procedure = `${scope}_users_checkout_date`;
      queryArgs = [...identity, ...dates, request.startTime, request.endTime];
      break;
    case 'longDuration':
      procedure = `${scope}_users_checkout_list_duration`;
      queryArgs = [...identity, ...dates, String(request.workingHours)];
      break;
    case 'denial':
      procedure = `${scope}_users_denial_users`;
      queryArgs = [...identity, ...dates];
      break;
    case 'borrow':
      procedure = `${scope}_users_borrow`;
      queryArgs = [...identity, ...dates];
      break;
    case 'department':
      procedure = 'division_groups_department_grid';
      queryArgs = [...identity, '30'];
      break;
    case 'date':
      procedure = 'group_date';
      queryArgs = [...identity, ...dates];
      break;
    case 'member':
      procedure = 'group_member_usage';
      queryArgs = [...identity, ...dates, String(request.workingHours)];
      break;
  }
  return `call esms_m.r_${procedure}(${queryArgs.map(sqlString).join(',')});`;
}
