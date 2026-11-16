import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PendingTasks,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { TabService } from '../../../features/tabs/tab.service';
import { ReportRange } from '../../../shared/filters/range-filter';
import { ReportActionBar } from '../../../shared/report-action-bar/report-action-bar';
import { ReportSettings } from '../../../shared/report-settings.service';
import { LicenseScope } from '../grouped-reports';
import { OrganizationRow, OrganizationTile } from '../organization/organization.data';
import { reportDrilldownRange } from './drilldown-range';
import { LicenseActionId, licenseActions } from './license-actions';
import { LICENSE_DRILLDOWN_LOADER } from './license-drilldown-loader';

/** Company selectNode arms a view; a Software/gauge click opens it. Bundle opens immediately. */
@Component({
  selector: 'app-license-drilldown',
  imports: [ReportActionBar],
  templateUrl: './license-drilldown.html',
  styleUrl: './license-drilldown.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseDrilldown {
  readonly scope = input<LicenseScope>('organization');
  readonly tile = input<OrganizationTile | null>(null);
  readonly reportSettings = input.required<ReportSettings>();
  readonly allRows = input.required<OrganizationRow[]>();
  readonly reportRange = input<ReportRange>({ kind: 'days', days: '30' });

  private readonly tabs = inject(TabService);
  private readonly loadView = inject(LICENSE_DRILLDOWN_LOADER);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly destroyRef = inject(DestroyRef);
  private readonly selectedId = signal<LicenseActionId>('summary');
  private requestVersion = 0;

  protected readonly actions = computed(() =>
    licenseActions(this.scope(), this.reportSettings(), this.allRows().length),
  );
  protected readonly activeAction = computed(
    () =>
      this.actions().find((action) => action.id === this.selectedId() && !action.disabled) ??
      this.actions()[0],
  );
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const tile = this.tile();
      // Changes to the selected view/settings must never reopen the previously selected row.
      if (tile) untracked(() => this.openReport(this.activeAction().id, tile));
    });
  }

  protected selectAction(id: LicenseActionId): void {
    const action = this.actions().find((candidate) => candidate.id === id);
    if (!action || action.disabled) return;
    this.requestVersion++;
    this.loading.set(false);
    this.error.set('');
    this.selectedId.set(id);
    if (id === 'bundle') this.openReport(id, null);
  }

  protected retry(): void {
    this.openReport(this.activeAction().id, this.tile());
  }

  private openReport(id: LicenseActionId, tile: OrganizationTile | null): void {
    const action = this.actions().find((candidate) => candidate.id === id);
    if (!action || action.disabled || (id !== 'bundle' && !tile)) return;
    const version = ++this.requestVersion;
    const context = {
      scope: this.scope(),
      tile,
      rows: this.allRows(),
      range: reportDrilldownRange(this.reportRange(), new Date()),
      reportRange: this.reportRange(),
      settings: this.reportSettings(),
    };
    this.loading.set(true);
    this.error.set('');
    this.pendingTasks.run(async () => {
      const isCurrent = () => !this.destroyRef.destroyed && version === this.requestVersion;
      try {
        const view = await this.loadView(id, context);
        if (!isCurrent() || !view) return;
        this.tabs.openComponent(
          {
            mainMenuName: id === 'bundle' ? 'Organization' : (tile?.title ?? 'Organization'),
            subMenuName: action.label,
          },
          view.component,
          view.inputs,
        );
      } catch {
        if (isCurrent()) this.error.set(`Unable to open ${action.label}. Please try again.`);
      } finally {
        if (isCurrent()) this.loading.set(false);
      }
    });
  }
}
