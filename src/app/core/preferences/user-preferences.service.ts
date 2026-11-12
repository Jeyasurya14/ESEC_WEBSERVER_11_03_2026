import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, sqlString } from '../api/api.service';
import { LoginService } from '../auth/login.service';

export type StoredPreferences = Record<string, unknown>;

const NEVER_SAVED = ['password'];

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
      const result = await firstValueFrom(
        this.api.call<Array<{ pref?: string }>>(
          `call esms_m.a_user_pref_load(${sqlString(userId)});`,
        ),
      );
      const text =
        result?.status === 'PASS' && Array.isArray(result.message) ? result.message[0]?.pref : '';

      const [saved] = text ? (JSON.parse(text) as StoredPreferences[]) : [];
      return saved && typeof saved === 'object' ? saved : {};
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

    const preferences = { ...(await this.load()) };
    NEVER_SAVED.forEach((key) => delete preferences[key]);

    const sql = `call esms_m.a_user_pref_insert(${sqlString(this.userId)}, ${sqlString(JSON.stringify([preferences]))});`;
    await firstValueFrom(this.api.write(sql)).catch(() => undefined); // a failed save keeps the choice for this session

    await this.writeUntilSaved();
  }
}
