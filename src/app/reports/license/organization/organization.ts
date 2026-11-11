import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { UserMenu } from '../../../core/models';
import { ExpiryFilter } from '../../../shared/filters/expiry-filter';
import { FeatureGroupFilter } from '../../../shared/filters/feature-group-filter';
import { OptionFilter } from '../../../shared/filters/option-filter';
import { RangeFilter } from '../../../shared/filters/range-filter';
import { ReportFilters } from '../../../shared/filters/report-filters';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { ServerStatusFilter } from '../../../shared/filters/server-status-filter';
import { ALL_BANDS, UsageBandFilter } from '../../../shared/filters/usage-band-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import { ReportSettings } from '../../../shared/report-settings.service';
import {
  OrganizationRow,
  organizationCall,
  organizationColumns,
  prepareRows,
  visibleRows,
} from './organization.data';

@Component({
  selector: 'app-organization',
  imports: [
    DataGrid,
    ExpiryFilter,
    FeatureGroupFilter,
    OptionFilter,
    RangeFilter,
    SearchFilter,
    ServerStatusFilter,
    UsageBandFilter,
  ],
  templateUrl: './organization.html',
  styleUrl: './organization.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportFilters, ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Organization implements OnInit {
  readonly menu = input.required<UserMenu>();
  readonly filters = inject(ReportFilters);
  readonly data = inject<ReportData<OrganizationRow>>(ReportData);
  readonly rowCount = signal('');

  readonly rows = computed(() => {
    const settings = this.filters.settings();
    if (!settings) {
      return [];
    }
    const choices = {
      serverStatus: this.filters.serverStatus(),
      notExpired: this.filters.notExpired(),
      option: this.filters.option(),
      bands: this.filters.bands(),
    };
    return visibleRows(this.data.rows(), choices, settings, new Date());
  });

  readonly columns = computed(() => {
    const settings = this.filters.settings();
    return settings ? organizationColumns(settings) : [];
  });

  constructor() {
    effect(() => {
      this.filters.range();
      this.filters.featureGroup();
      const settings = this.filters.settings();
      if (settings) {
        untracked(() => this.load(settings));
      }
    });
  }

  ngOnInit(): void {
    void this.start();
  }

  refresh(): void {
    const settings = this.filters.settings();
    if (settings) {
      this.load(settings);
    } else {
      void this.start();
    }
  }

  clearFilters(): void {
    this.filters.search.set('');
    this.filters.bands.set([...ALL_BANDS]);
  }

  private async start(): Promise<void> {
    if (!(await this.filters.start())) {
      this.data.fail(this.filters.error());
    }
  }

  private load(settings: ReportSettings): void {
    const sql = organizationCall(
      this.data.userId(),
      this.filters.range(),
      this.filters.featureGroup(),
    );
    void this.data.load(sql, (rows) => prepareRows(rows, settings.workingHoursPerDay));
  }
}
