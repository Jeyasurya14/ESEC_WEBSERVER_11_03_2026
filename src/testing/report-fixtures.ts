import type { OrganizationRow } from '../app/reports/license/organization/organization.data';
import { DEFAULT_REPORT_SETTINGS } from '../app/shared/report-settings.service';
import type { DetailParameters } from '../app/reports/license/detail/detail-queries';
import type { ReportSettings, HeatmapColorScale } from '../app/shared/report-settings.service';

export function organizationRow(overrides: Partial<OrganizationRow> = {}): OrganizationRow {
  return {
    sw: '',
    server: '',
    location: '',
    lic: '',
    lic_name: '',
    l_qty_i: 0,
    max_qty_i: 0,
    l_qty_r: 0,
    qty_r: 0,
    qty_db: 0,
    qty_dp: 0,
    p_dp: 0,
    qty_da: 0,
    p_da: 0,
    qty_dpm: 0,
    p_dpm: 0,
    qty_dam: 0,
    p_dam: 0,
    qty_wp: 0,
    p_wp: 0,
    qty_wa: 0,
    p_wa: 0,
    qty_wpm: 0,
    p_wpm: 0,
    qty_wam: 0,
    p_wam: 0,
    tot_du_q: 0,
    tlh_24: 0,
    per_tot_du_q: 0,
    di: 0,
    ndivn: 0,
    ndept: 0,
    de: 0,
    ad: 0,
    td: 0,
    w_days: 0,
    days: 0,
    w_dp_days: 0,
    dp_days: 0,
    expiry: '',
    start_date: '',
    last_date: '',
    status: '',
    bundle: '',
    ...overrides,
  };
}

export function reportSettings(
  overrides: Omit<Partial<ReportSettings>, 'heatmapColors'> & {
    heatmapColors?: Partial<HeatmapColorScale>;
  } = {},
): ReportSettings {
  return {
    ...DEFAULT_REPORT_SETTINGS,
    ...overrides,
    heatmapColors: { ...DEFAULT_REPORT_SETTINGS.heatmapColors, ...overrides.heatmapColors },
  };
}

export function detailParameters(overrides: Partial<DetailParameters> = {}): DetailParameters {
  return {
    ...{
      start: '',
      end: '',
      startTime: '00:00',
      endTime: '23:59',
      workingDays: false,
      workingHours: 24,
      businessHours: false,
      granularity: 'date',
      usageView: 'summary',
      checkoutView: 'date',
      category: 'date',
      reduction: 1,
      newCalculation: false,
    },
    ...overrides,
  };
}
