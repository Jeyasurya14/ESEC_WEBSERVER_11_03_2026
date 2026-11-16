import { apiRequest, resourceRequest } from '../../core/api/api-request';
import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  DestroyRef,
  computed,
  resource,
  inject,
  model,
  signal,
  Injector,
} from '@angular/core';

import { ApiService, sqlString } from '../../core/api/api.service';
import { LoginService } from '../../core/auth/login.service';
import { BrowserStorage, StorageKey } from '../../core/storage/browser-storage.service';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';

const BUILT_IN_GROUPS = ['All Feature', 'Primary Feature'];

export function featureGroupParam(group: string): string {
  if (group === 'All Feature') return 'All';
  if (group === 'Primary Feature') return 'Pri';
  return group;
}

@Injectable({ providedIn: 'root' })
export class FeatureGroupsService {
  private readonly injector = inject(Injector);

  private readonly api = inject(ApiService);
  private readonly loginService = inject(LoginService);
  private readonly storage = inject(BrowserStorage);
  private readonly groupsByUserId = new Map<string, Promise<string[]>>();
  readonly revision = signal(0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.groupsByUserId.clear());
  }

  invalidate(): void {
    this.groupsByUserId.clear();
    this.revision.update((value) => value + 1);
  }

  load(): Promise<string[]> {
    const userId = this.loginService.user()?.userId ?? '';
    if (!userId) return Promise.resolve([...BUILT_IN_GROUPS]);
    let loadedGroups = this.groupsByUserId.get(userId);
    if (!loadedGroups) {
      // Only the active user needs cached groups; do not retain previous sessions.
      this.groupsByUserId.clear();
      loadedGroups = this.fetch(userId);
      this.groupsByUserId.set(userId, loadedGroups);
    }
    return loadedGroups;
  }

  private async fetch(userId: string): Promise<string[]> {
    const groupResponse = await resourceRequest(this.injector, (abortSignal) =>
      apiRequest(
        this.api.call<Array<{ COLLECTION_NAME: string }>>(
          `call R_A_CLTX_ESEC_MF_LOAD(${sqlString(userId)});`,
        ),
        abortSignal,
      ),
    ).catch(() => null);

    if (groupResponse?.status !== 'PASS') this.groupsByUserId.delete(userId);

    const groupRows =
      groupResponse?.status === 'PASS' && Array.isArray(groupResponse.message)
        ? groupResponse.message
        : [];
    const userGroups = groupRows.map((row) => row.COLLECTION_NAME).filter(Boolean);

    if (this.loginService.user()?.userId === userId)
      this.storage.set(StorageKey.featureGroups, userGroups.join(','));
    return [...new Set([...BUILT_IN_GROUPS, ...userGroups])];
  }
}

@Component({
  selector: 'app-feature-group-filter',
  imports: [Dropdown],
  template: `
    <label class="filter">
      <span class="filter-label">Feature</span>
      <app-dropdown ariaLabel="Feature" [options]="options()" [(value)]="group" />
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureGroupFilter {
  readonly group = model.required<string>();

  private readonly groupService = inject(FeatureGroupsService);
  private readonly loginService = inject(LoginService);
  private readonly groupData = resource({
    params: () => ({
      revision: this.groupService.revision(),
      userId: this.loginService.user()?.userId ?? '',
    }),
    defaultValue: BUILT_IN_GROUPS,
    loader: () => this.groupService.load(),
  });
  protected readonly groups = computed(() => this.groupData.value());

  protected readonly options = computed<DropdownOption[]>(() => {
    const availableGroups = this.groups();
    const groupNames = availableGroups.includes(this.group())
      ? availableGroups
      : [this.group(), ...availableGroups];
    return groupNames.map((groupName) => ({ value: groupName, label: groupName }));
  });
}
