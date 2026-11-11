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
  private readonly loaded = new Map<string, Promise<string[]>>();

  load(): Promise<string[]> {
    const userId = this.loginService.user()?.userId ?? '';
    let groups = this.loaded.get(userId);
    if (!groups) {
      groups = this.fetch(userId);
      this.loaded.set(userId, groups);
    }
    return groups;
  }

  private async fetch(userId: string): Promise<string[]> {
    const result = await firstValueFrom(
      this.api.call<Array<{ COLLECTION_NAME: string }>>(
        `call R_A_CLTX_ESEC_MF_LOAD(${sqlString(userId)});`,
      ),
    ).catch(() => null);

    const rows = result?.status === 'PASS' && Array.isArray(result.message) ? result.message : [];
    const userGroups = rows.map((row) => row.COLLECTION_NAME).filter(Boolean);

    this.storage.set(StorageKey.featureGroups, userGroups.join(','));
    return [...BUILT_IN_GROUPS, ...userGroups];
  }
}

@Component({
  selector: 'app-feature-group-filter',
  template: `
    <label class="filter">
      <span class="filter-label">Feature</span>
      <select (change)="group.set($any($event.target).value)">
        @for (name of options(); track name) {
          <option [value]="name" [selected]="group() === name">{{ name }}</option>
        }
      </select>
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureGroupFilter {
  readonly group = model.required<string>();

  protected readonly groups = signal<string[]>(BUILT_IN_GROUPS);

  protected readonly options = computed(() => {
    const groups = this.groups();
    return groups.includes(this.group()) ? groups : [this.group(), ...groups];
  });

  constructor() {
    void inject(FeatureGroupsService)
      .load()
      .then((groups) => this.groups.set(groups));
  }
}
