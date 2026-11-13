import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  computed,
  inject,
  model,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
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
  private readonly api = inject(ApiService);
  private readonly loginService = inject(LoginService);
  private readonly storage = inject(BrowserStorage);
  private readonly groupsByUserId = new Map<string, Promise<string[]>>();

  load(): Promise<string[]> {
    const userId = this.loginService.user()?.userId ?? '';
    let loadedGroups = this.groupsByUserId.get(userId);
    if (!loadedGroups) {
      loadedGroups = this.fetch(userId);
      this.groupsByUserId.set(userId, loadedGroups);
    }
    return loadedGroups;
  }

  private async fetch(userId: string): Promise<string[]> {
    const groupResponse = await firstValueFrom(
      this.api.call<Array<{ COLLECTION_NAME: string }>>(
        `call R_A_CLTX_ESEC_MF_LOAD(${sqlString(userId)});`,
      ),
    ).catch(() => null);

    const groupRows =
      groupResponse?.status === 'PASS' && Array.isArray(groupResponse.message)
        ? groupResponse.message
        : [];
    const userGroups = groupRows.map((row) => row.COLLECTION_NAME).filter(Boolean);

    this.storage.set(StorageKey.featureGroups, userGroups.join(','));
    return [...BUILT_IN_GROUPS, ...userGroups];
  }
}

@Component({
  selector: 'app-feature-group-filter',
  imports: [Dropdown],
  template: `
    <label class="filter">
      <span class="filter-label">Feature</span>
      <app-dropdown [options]="options()" [(value)]="group" />
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureGroupFilter {
  readonly group = model.required<string>();

  protected readonly groups = signal<string[]>(BUILT_IN_GROUPS);

  protected readonly options = computed<DropdownOption[]>(() => {
    const availableGroups = this.groups();
    const groupNames = availableGroups.includes(this.group())
      ? availableGroups
      : [this.group(), ...availableGroups];
    return groupNames.map((groupName) => ({ value: groupName, label: groupName }));
  });

  constructor() {
    void inject(FeatureGroupsService)
      .load()
      .then((groups) => this.groups.set(groups));
  }
}
