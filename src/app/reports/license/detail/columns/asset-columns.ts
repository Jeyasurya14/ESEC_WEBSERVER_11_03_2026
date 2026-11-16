import {
  Column,
  columnGroup,
  dateColumn,
  numberColumn,
  percentColumn,
  textColumn,
} from '../../../../shared/grid/columns';
import { LicenseRecord } from '../../report-helpers';
import { ReportSettings } from '../../../../shared/report-settings.service';

export function assetInfoColumns(reportSettings: ReportSettings): Column<LicenseRecord>[] {
  return [
    textColumn('server', 'Server', { width: 150, pinned: 'left' }),
    textColumn('lic', 'License', { width: 150, hide: true }),
    textColumn('lic_name', 'Feature', { width: 150, pinned: 'left' }),
    textColumn('asset_info', 'Asset Info', { width: 150 }),
    textColumn('ver', 'Version', { width: 100 }),
    numberColumn('qty_i', 'Issued', { width: 90 }),
    columnGroup('Day Peak', [
      numberColumn('qty_dp', 'Qty', { width: 90 }),
      percentColumn('p_dp', '%', reportSettings, { width: 60 }),
    ]),
    columnGroup('Day Avg', [
      numberColumn('qty_da', 'Qty', { width: 90, hide: true }),
      percentColumn('p_da', '%', reportSettings, { width: 60, hide: true }),
    ]),
    columnGroup('Day Peak Mean', [
      numberColumn('qty_dpm', 'Qty', { width: 90, hide: true }),
      percentColumn('p_dpm', '%', reportSettings, { width: 60, hide: true }),
    ]),
    columnGroup('Day Avg Mean', [
      numberColumn('qty_dam', 'Qty', { width: 90, hide: true }),
      percentColumn('p_dam', '%', reportSettings, { width: 60, hide: true }),
    ]),
    columnGroup('Work Peak', [
      numberColumn('qty_wp', 'Qty', { width: 90 }),
      percentColumn('p_wp', '%', reportSettings, { width: 60 }),
    ]),
    columnGroup('Work Avg', [
      numberColumn('qty_wa', 'Qty', { width: 90, hide: true }),
      percentColumn('p_wa', '%', reportSettings, { width: 60, hide: true }),
    ]),
    columnGroup('Work Peak Mean', [
      numberColumn('qty_wpm', 'Qty', { width: 90, hide: true }),
      percentColumn('p_wpm', '%', reportSettings, { width: 60, hide: true }),
    ]),
    columnGroup('Work Avg Mean', [
      numberColumn('qty_wam', 'Qty', { width: 90, hide: true }),
      percentColumn('p_wam', '%', reportSettings, { width: 60, hide: true }),
    ]),
    numberColumn('count_days', 'License Days', { width: 100 }),
    numberColumn('di', 'Users', { width: 70 }),
    columnGroup('License Hours', [
      numberColumn('used_hours', 'Used', { width: 90 }),
      numberColumn('license_hours', 'Available', { width: 100 }),
      percentColumn('p_used_hours', '%', reportSettings, { width: 70 }),
    ]),
    columnGroup('Date', [
      numberColumn('issued', 'Issued', { width: 90 }),
      dateColumn('expiry', 'Expiry', { width: 100 }),
    ]),
  ];
}
