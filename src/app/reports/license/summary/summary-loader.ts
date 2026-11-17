import { Injectable, computed } from '@angular/core';

import { ReportData, combinedLastUpdated } from '../../../shared/report-data';
import { OrganizationRow } from '../organization/organization.data';
import { LicenseScope } from '../grouped-reports';
import { SUMMARY_PERIODS, SummaryPeriod, SummaryRecord, summaryCall } from './license-summary.data';

export interface SummaryChart {
  readonly id: SummaryPeriod;
  readonly title: string;
  readonly suffix: string;
  readonly data: ReportData<SummaryRecord>;
}

@Injectable()
export class SummaryLoader {
  readonly charts: readonly SummaryChart[] = SUMMARY_PERIODS.map((period) => ({
    ...period,
    data: new ReportData<SummaryRecord>(),
  }));
  readonly indicators: ReportData<SummaryRecord> = new ReportData<SummaryRecord>();
  private readonly reportSources: readonly ReportData<SummaryRecord>[] = [
    ...this.charts.map((chart) => chart.data),
    this.indicators,
  ];
  readonly loading = computed(() => this.reportSources.some((reportData) => reportData.loading()));
  readonly lastUpdated = computed(() => combinedLastUpdated(this.reportSources));

  bind(source: () => { row: OrganizationRow; scope: LicenseScope }): void {
    for (const chart of this.charts) {
      chart.data.bind(() => {
        const { row, scope } = source();
        return { kind: 'load', sql: summaryCall(scope, row, chart.id) };
      });
    }
    this.indicators.bind(() => {
      const { row, scope } = source();
      return { kind: 'load', sql: summaryCall(scope, row, 'indicators') };
    });
  }

  refresh(): void {
    for (const reportData of this.reportSources) reportData.refresh();
  }
}
