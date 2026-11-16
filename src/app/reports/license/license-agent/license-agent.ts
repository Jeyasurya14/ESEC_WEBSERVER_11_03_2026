import { apiRequest, resourceRequest } from '../../../core/api/api-request';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
  Injector,
} from '@angular/core';
import { UserMenu } from '../../../core/models';

import { ApiService } from '../../../core/api/api.service';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import { registerLicenseRefresh } from '../report-helpers';
import { formatDate } from '../../../shared/dates';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import { ReportSettings, ReportSettingsService } from '../../../shared/report-settings.service';
import {
  LicenseAgentRow,
  defaultPeriod,
  licenseAgentCall,
  licenseAgentColumns,
} from './license-agent.data';

/**
 * License / License and Agent Combined - license hours used per computer, for one software.
 *
 * Loads after a software is chosen from the same list procedure as the source app.
 */
@Component({
  selector: 'app-license-agent',
  imports: [DataGrid, SearchFilter, Dropdown],
  templateUrl: './license-agent.html',
  styleUrl: './license-agent.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseAgent implements OnInit {
  private readonly injector = inject(Injector);

  readonly menu = input.required<UserMenu>();
  readonly reportData = inject<ReportData<LicenseAgentRow>>(ReportData);
  private readonly settingsService = inject(ReportSettingsService);
  private readonly api = inject(ApiService);
  readonly softwareOptions = signal([{ value: '', label: 'Select software' }]);
  readonly softwareError = signal('');

  readonly settings = signal<ReportSettings | null>(null);
  readonly softwareName = signal('');
  readonly searchText = signal('');
  readonly rowCount = signal('');

  readonly selectedPeriod = defaultPeriod(new Date());
  readonly periodLabel = `${formatDate(this.selectedPeriod.startDate)} To ${formatDate(this.selectedPeriod.endDate)}`;

  readonly columns = computed(() => {
    const settings = this.settings();
    return settings ? licenseAgentColumns(settings.divisionLabel, settings.departmentLabel) : [];
  });

  constructor() {
    this.reportData.bind(() => {
      const softwareName = this.softwareName().trim();
      if (!softwareName) return { kind: 'idle' };
      const settings = this.settings();
      if (!settings) return undefined;
      const { startDate, endDate } = this.selectedPeriod;
      return {
        kind: 'load',
        sql: licenseAgentCall(softwareName, startDate, endDate, settings.workingHoursPerDay),
      };
    });
    registerLicenseRefresh(this.reportData, () => this.refresh());
  }

  async ngOnInit(): Promise<void> {
    void this.loadSoftware();
    try {
      this.settings.set(await this.settingsService.load());
    } catch {
      this.reportData.fail('Unable to load the report settings. Please refresh to try again.');
    }
  }

  chooseSoftware(name: string): void {
    this.softwareName.set(name);
  }

  refresh(): void {
    if (!this.settings()) {
      void this.ngOnInit();
      return;
    }
    if (this.softwareName()) this.reportData.refresh();
    else void this.loadSoftware();
  }

  async loadSoftware(): Promise<void> {
    this.softwareError.set('');
    try {
      const response = await resourceRequest(this.injector, (abortSignal) =>
        apiRequest(
          this.api.call<Array<{ sw_name?: string; sw?: string; exe?: string }>>(
            'call esms_m.r_license_agent_sw_list();',
          ),
          abortSignal,
        ),
      );
      if (response.status !== 'PASS' || !Array.isArray(response.message)) throw new Error();
      const names = [
        ...new Set(
          response.message.map((row) => row.sw_name || row.sw || row.exe || '').filter(Boolean),
        ),
      ].sort();
      this.softwareOptions.set([
        { value: '', label: 'Select software' },
        ...names.map((value) => ({ value, label: value })),
      ]);
    } catch {
      this.softwareError.set('Unable to load software names. Please refresh to try again.');
    }
  }
}
