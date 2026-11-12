import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { UserMenu } from '../../../core/models';
import { TAB_ID, TabService } from '../../../features/tabs/tab.service';
import { ExpiryFilter } from '../../../shared/filters/expiry-filter';
import { FeatureGroupFilter } from '../../../shared/filters/feature-group-filter';
import { OptionFilter } from '../../../shared/filters/option-filter';
import { RangeFilter } from '../../../shared/filters/range-filter';
import { ReportFilters } from '../../../shared/filters/report-filters';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { ServerStatusFilter } from '../../../shared/filters/server-status-filter';
import { ALL_BANDS, UsageBandFilter } from '../../../shared/filters/usage-band-filter';
import { GaugeTile } from '../../../shared/gauge/gauge-tile';
import { DataGrid, rowCountText } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import { ReportSettings } from '../../../shared/report-settings.service';
import {
  OrganizationRow,
  organizationCall,
  organizationColumns,
  organizationTiles,
  prepareRows,
  searchTiles,
  visibleRows,
} from './organization.data';

/** The two ways this report can show its rows. */
export type OrganizationView = 'grid' | 'gauge';

@Component({
  selector: 'app-organization',
  imports: [
    DataGrid,
    ExpiryFilter,
    FeatureGroupFilter,
    GaugeTile,
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
  readonly view = signal<OrganizationView>('grid');

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

  /** The gauge view's own tiles - the same filtered rows as the grid, reshaped for `app-gauge-tile`. */
  readonly tiles = computed(() =>
    searchTiles(organizationTiles(this.rows(), this.filters.option()), this.filters.search()),
  );

  /** "Rows : ..." reads from the grid's own count in grid view, and the tile count in gauge view. */
  readonly rowCountLabel = computed(() => {
    if (this.view() === 'grid') {
      return this.rowCount();
    }
    const searching = this.filters.search().trim().length > 0;
    return rowCountText(this.tiles().length, this.rows().length, searching);
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

    // Puts this report's refresh control in the shared status bar instead of its own toolbar -
    // see TabsComponent for how a tab id ends up here. Nothing to do when there isn't one (a
    // test rendering this component directly, say).
    const tabId = inject(TAB_ID, { optional: true });
    if (tabId !== null) {
      const tabs = inject(TabService);
      tabs.setRefreshHandle(tabId, { loading: () => this.data.loading(), refresh: () => this.refresh() });
      inject(DestroyRef).onDestroy(() => tabs.setRefreshHandle(tabId, null));
    }
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

  toggleView(): void {
    this.view.update((current) => (current === 'grid' ? 'gauge' : 'grid'));
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
