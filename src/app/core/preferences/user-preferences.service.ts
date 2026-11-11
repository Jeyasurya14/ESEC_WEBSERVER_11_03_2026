import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, sqlString } from '../api/api.service';
import { LoginService } from '../auth/login.service';

export type StoredPreferences = Record<string, unknown>;

/** Never written back, even if an older client stored it. */
const NEVER_SAVED = ['password'];

/**
 * The signed-in user's saved choices (range, option, feature group, ...). They live in the same
 * table, under the same keys, as the company app's, so a choice made in either app shows in both.
 *
 * Saving always writes the whole set back, so keys this app doesn't use are kept as they are.
 */
@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly api = inject(ApiService);
  private readonly loginService = inject(LoginService);

  private userId = '';
  private stored: Promise<StoredPreferences> | null = null;
  private saving: Promise<void> | null = null;
  private unsaved = false;

  /** The saved choices; empty when the user has none yet or they can't be read. Loaded once per user. */
  load(): Promise<StoredPreferences> {
    const userId = this.loginService.user()?.userId ?? '';
    if (userId !== this.userId || !this.stored) {
      this.userId = userId;
      this.stored = this.fetch(userId);
    }
    return this.stored;
  }

  /** Merges `changes` into the saved choices and writes them. Rapid changes are written as one. */
  async save(changes: StoredPreferences): Promise<void> {
    Object.assign(await this.load(), changes);
    this.unsaved = true;
    this.saving ??= this.writeUntilSaved();
    return this.saving;
  }

  private async fetch(userId: string): Promise<StoredPreferences> {
    try {
      const result = await firstValueFrom(
        this.api.call<Array<{ pref?: string }>>(`call esms_m.a_user_pref_load(${sqlString(userId)});`),
      );
      const text = result?.status === 'PASS' && Array.isArray(result.message) ? result.message[0]?.pref : '';
      // Stored as a JSON array holding one object, as the company app writes it.
      const [saved] = text ? (JSON.parse(text) as StoredPreferences[]) : [];
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {}; // Unreadable preferences must not stop a report from opening; defaults apply.
    }
  }

  /** Writes the current choices, then writes again if more changes arrived while saving. */
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
