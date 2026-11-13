import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, sqlString } from '../api/api.service';
import { LoginService } from '../auth/login.service';

export type StoredPreferences = Record<string, unknown>;

const NON_PERSISTENT_PREFERENCE_KEYS = ['password'];

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly api = inject(ApiService);
  private readonly loginService = inject(LoginService);

  private userId = '';
  private stored: Promise<StoredPreferences> | null = null;
  private saving: Promise<void> | null = null;
  private unsaved = false;

  load(): Promise<StoredPreferences> {
    const userId = this.loginService.user()?.userId ?? '';
    if (userId !== this.userId || !this.stored) {
      this.userId = userId;
      this.stored = this.fetch(userId);
    }
    return this.stored;
  }

  async save(changes: StoredPreferences): Promise<void> {
    Object.assign(await this.load(), changes);
    this.unsaved = true;
    this.saving ??= this.writeUntilSaved();
    return this.saving;
  }

  private async fetch(userId: string): Promise<StoredPreferences> {
    try {
      const preferenceResponse = await firstValueFrom(
        this.api.call<Array<{ pref?: string }>>(
          `call esms_m.a_user_pref_load(${sqlString(userId)});`,
        ),
      );
      const preferencesJson =
        preferenceResponse?.status === 'PASS' && Array.isArray(preferenceResponse.message)
          ? preferenceResponse.message[0]?.pref
          : '';

      const [savedPreferences] = preferencesJson
        ? (JSON.parse(preferencesJson) as StoredPreferences[])
        : [];
      return savedPreferences && typeof savedPreferences === 'object' ? savedPreferences : {};
    } catch {
      return {};
    }
  }

  private async writeUntilSaved(): Promise<void> {
    if (!this.unsaved) {
      this.saving = null;
      return;
    }
    this.unsaved = false;

    const preferencesToSave = { ...(await this.load()) };
    NON_PERSISTENT_PREFERENCE_KEYS.forEach((key) => delete preferencesToSave[key]);

    const saveQuery = `call esms_m.a_user_pref_insert(${sqlString(this.userId)}, ${sqlString(JSON.stringify([preferencesToSave]))});`;
    await firstValueFrom(this.api.write(saveQuery)).catch(() => undefined); // a failed save keeps the choice for this session

    await this.writeUntilSaved();
  }
}
