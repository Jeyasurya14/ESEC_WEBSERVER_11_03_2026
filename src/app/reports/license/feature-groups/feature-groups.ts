import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { ApiService, sqlString } from '../../../core/api/api.service';
import { UserMenu } from '../../../core/models';
import { toggled } from '../../../core/utils/data';
import { inputValue } from '../../../shared/input-value';
import { Dropdown, DropdownOption } from '../../../shared/dropdown/dropdown';
import { FeatureGroupsService } from '../../../shared/filters/feature-group-filter';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import { TabService } from '../../../features/tabs/tab.service';
import { CustomReport } from '../custom-report/custom-report';
import { CustomReportView, ReportFeature } from '../custom-report/custom-report.data';
import { registerLicenseRefresh } from '../report-helpers';
import {
  FeatureRow,
  addFeatureCall,
  allFeaturesCall,
  createGroupCall,
  featureKey,
  groupFeaturesCall,
  myFeatureColumns,
  removeFeatureCall,
  selectionChanges,
} from './feature-groups.data';

import { savedFeatureKeys, selectedFeatures } from './feature-groups.utils';

type GroupSelection =
  { kind: 'ready'; keys: ReadonlySet<string> } | { kind: 'error'; message: string };

const BUILT_IN_GROUPS = new Set(['All Feature', 'Primary Feature']);

/**
 * License / My Feature: not a report but a picker - the user ticks which features belong to one
 * of their named feature groups (the groups the other reports' Feature filter offers), as the
 * company app's Ev3SettingsFeaturesComponent does. Group reports open in workspace tabs.
 */
@Component({
  selector: 'app-license-my-feature',
  imports: [DataGrid, Dropdown, SearchFilter],
  templateUrl: './feature-groups.html',
  styleUrl: './feature-groups.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureGroups implements OnInit {
  protected readonly inputValue = inputValue;

  readonly menu = input.required<UserMenu>();

  private readonly api = inject(ApiService);
  private readonly tabs = inject(TabService, { optional: true });
  private readonly featureGroups = inject(FeatureGroupsService);
  protected readonly reportData = inject<ReportData<FeatureRow>>(ReportData);

  protected readonly searchText = signal('');
  protected readonly groups = signal<string[]>([]);
  protected readonly selectedGroup = signal('');
  protected readonly newGroupName = signal('');
  protected readonly statusMessage = signal('');
  protected readonly isSaving = signal(false);
  // rxResource unsubscribes the previous group's request when another group is picked.
  private readonly groupSelection = rxResource({
    params: () => {
      const userId = this.reportData.userId();
      const groupName = this.selectedGroup();
      return userId && groupName ? groupFeaturesCall(userId, groupName) : undefined;
    },
    defaultValue: { kind: 'ready', keys: new Set<string>() } satisfies GroupSelection,
    stream: ({ params }) =>
      this.api.call<unknown>(params).pipe(
        map((response): GroupSelection =>
          response.status !== 'PASS'
            ? {
                kind: 'error',
                message:
                  typeof response.message === 'string'
                    ? response.message
                    : 'Unable to load the selected group.',
              }
            : { kind: 'ready', keys: savedFeatureKeys(response.message) },
        ),
        catchError(() =>
          of<GroupSelection>({
            kind: 'error',
            message: 'Unable to load the selected group. Select it again to retry.',
          }),
        ),
      ),
  });
  protected readonly groupLoading = this.groupSelection.isLoading;
  private readonly loadedGroup = computed(() =>
    this.groupSelection.hasValue() ? this.groupSelection.value() : undefined,
  );
  private readonly loadedKeys = computed<ReadonlySet<string>>(() => {
    const group = this.loadedGroup();
    return group?.kind === 'ready' ? group.keys : new Set();
  });

  // Both reset to the group's saved features each time a group loads.
  /** What the group holds on the server - what Save compares the ticks against. */
  private readonly savedFeatureIds = linkedSignal(() => this.loadedKeys());
  /** The ticks the user has made since. */
  private readonly selectedFeatureIds = linkedSignal(() => new Set(this.loadedKeys()));

  /** The last action's message, else why the selected group couldn't load. */
  protected readonly message = computed(() => {
    if (this.statusMessage()) return this.statusMessage();
    const group = this.loadedGroup();
    return group?.kind === 'error' ? group.message : '';
  });

  protected readonly groupOptions = computed<DropdownOption[]>(() => [
    { value: '', label: 'Select a group' },
    ...[...BUILT_IN_GROUPS].map((groupName) => ({
      value: groupName,
      label: groupName,
      group: 'System',
    })),
    ...this.groups().map((groupName) => ({ value: groupName, label: groupName })),
  ]);
  protected readonly canEdit = computed(
    () => !!this.selectedGroup() && !BUILT_IN_GROUPS.has(this.selectedGroup()),
  );

  protected readonly rows = computed(() =>
    selectedFeatures(this.reportData.rows(), this.selectedFeatureIds()),
  );

  protected readonly selectedCount = computed(() => this.selectedFeatureIds().size);

  protected readonly hasChanges = computed(() => {
    const { added, removed } = selectionChanges(
      this.rows(),
      this.savedFeatureIds(),
      this.selectedFeatureIds(),
    );
    return added.length + removed.length > 0;
  });

  protected readonly columns = myFeatureColumns((row) => this.toggle(row));
  protected readonly reportViews: CustomReportView[] = [
    'Utilization',
    'Percentile',
    'Usage',
    'License Month',
    'Checkout User',
    'Long Duration',
    'Denial',
    'Borrow',
  ];

  constructor() {
    this.reportData.bind(() => {
      const userId = this.reportData.userId();
      return userId ? { kind: 'load', sql: allFeaturesCall(userId) } : undefined;
    });
    registerLicenseRefresh(this.reportData, () => {
      this.reportData.refresh();
      this.groupSelection.reload();
    });
  }

  ngOnInit(): void {
    void this.loadGroups();
  }

  private async loadGroups(): Promise<void> {
    const groups = await this.featureGroups.load();
    this.groups.set(groups.filter((groupName) => !BUILT_IN_GROUPS.has(groupName)));
  }

  protected selectGroup(groupName: string): void {
    if (this.isSaving()) return;
    this.statusMessage.set('');
    this.selectedGroup.set(groupName);
  }

  protected async createGroup(): Promise<void> {
    const groupName = this.newGroupName().trim();
    if (this.isSaving()) return;
    if (!groupName) {
      this.statusMessage.set('Please enter a group name.');
      return;
    }
    if (
      BUILT_IN_GROUPS.has(groupName) ||
      this.groups().some((name) => name.toLowerCase() === groupName.toLowerCase())
    ) {
      this.statusMessage.set('Choose a new group name.');
      return;
    }

    this.isSaving.set(true);
    const created = await this.run(
      createGroupCall(this.reportData.userId(), groupName),
      'post_view_call',
      'Unable to create the group.',
    );
    this.isSaving.set(false);
    if (!created) return;
    if (!this.groups().includes(groupName)) {
      this.groups.update((groups) => [...groups, groupName]);
    }
    this.newGroupName.set('');
    this.selectGroup(groupName);
    this.statusMessage.set(`Group "${groupName}" created.`);
    this.featureGroups.invalidate();
  }

  protected async save(): Promise<void> {
    const groupName = this.selectedGroup();
    if (!this.canEdit() || this.isSaving() || this.groupLoading()) {
      return;
    }

    const userId = this.reportData.userId();
    const { added, removed } = selectionChanges(
      this.rows(),
      this.savedFeatureIds(),
      this.selectedFeatureIds(),
    );
    this.isSaving.set(true);
    try {
      if (removed.length) {
        const sql = removed.map((row) => removeFeatureCall(userId, groupName, row)).join('');
        if (!(await this.run(sql, 'post_delete_bulk', 'Unable to save the group.'))) return;
        const removedIds = new Set(removed.map(featureKey));
        this.savedFeatureIds.update(
          (keys) => new Set([...keys].filter((featureId) => !removedIds.has(featureId))),
        );
      }
      if (added.length) {
        const sql = added.map((row) => addFeatureCall(userId, groupName, row)).join('');
        if (!(await this.run(sql, 'post_insert_update', 'Unable to save the group.'))) return;
        this.savedFeatureIds.update((keys) => new Set([...keys, ...added.map(featureKey)]));
      }
      this.statusMessage.set('Data Saved');
      this.groupSelection.reload();
      this.featureGroups.invalidate();
    } finally {
      this.isSaving.set(false);
    }
  }

  protected openReport(view: CustomReportView, compare = false): void {
    if (this.groupLoading()) return;
    const keys = this.savedFeatureIds();
    const features: ReportFeature[] = this.reportData
      .rows()
      .filter((row) => keys.has(featureKey(row)))
      .map((row) => ({
        sw: row.SOFT_NAME,
        server: row.SERVER,
        lic: row.FEATURE,
        lic_name: row.FEATURE,
      }));
    if (!features.length) {
      this.statusMessage.set('Save at least one feature in this group before opening a report.');
      return;
    }
    this.tabs?.openComponent(
      { mainMenuName: this.selectedGroup(), subMenuName: view },
      CustomReport,
      {
        menu: { mainMenuName: 'LICENSE', subMenuName: 'Report Type 1' },
        initialFeatures: features,
        initialView: view,
        initialDetails: compare,
        initialChart: compare,
      },
    );
  }

  protected async deleteGroup(): Promise<void> {
    const groupName = this.selectedGroup();
    if (
      !this.canEdit() ||
      this.isSaving() ||
      !window.confirm(`Delete feature group "${groupName}"?`)
    )
      return;
    this.isSaving.set(true);
    const deleted = await this.run(
      [
        `call R_A_CLTX_ESEC_MF_DELETE(${sqlString(this.reportData.userId())},${sqlString(groupName)});`,
      ],
      'post_delete',
      'Unable to delete group.',
    );
    this.isSaving.set(false);
    if (!deleted) return;
    this.groups.update((groups) => groups.filter((name) => name !== groupName));
    this.selectedGroup.set('');
    this.featureGroups.invalidate();
    this.statusMessage.set('Group deleted.');
  }

  private toggle(row: FeatureRow): void {
    if (this.isSaving() || this.groupLoading() || !this.canEdit()) return;
    if (!this.selectedGroup()) {
      this.statusMessage.set('Select or create a group first.');
      return;
    }
    this.selectedFeatureIds.update((keys) => toggled(keys, featureKey(row)));
  }

  /** Posts `sql`; on failure shows the server's text (else `failedMessage`). Never throws. */
  private async run(
    sql: string | string[],
    endpoint: string,
    failedMessage: string,
  ): Promise<boolean> {
    try {
      await this.api.send(endpoint, sql, failedMessage);
      return true;
    } catch (error) {
      this.statusMessage.set(error instanceof Error ? error.message : failedMessage);
      return false;
    }
  }
}
