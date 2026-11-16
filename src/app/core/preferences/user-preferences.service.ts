import { apiRequest, resourceRequest } from '../api/api-request';
import { Injectable, inject, Injector } from '@angular/core';

import { ApiService, sqlString } from '../api/api.service';
import { LoginService } from '../auth/login.service';
import { isRecord } from '../utils/data';

export type StoredPreferences = Record<string, unknown>;

const NON_PERSISTENT_PREFERENCE_KEYS = ['password'];

interface PreferenceSession {
  userId: string;
  loadPromise: Promise<StoredPreferences>;
  savePromise: Promise<void> | null;
  hasChanges: boolean;
  isLoaded: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly injector = inject(Injector);

  private readonly api = inject(ApiService);
  private readonly loginService = inject(LoginService);

  private userSession: PreferenceSession | null = null;

  load(): Promise<StoredPreferences> {
    return this.getUserSession().loadPromise;
  }

  async save(newPreferences: StoredPreferences): Promise<void> {
    const userSession = this.getUserSession();
    const currentPreferences = await userSession.loadPromise;
    if (!this.isCurrentUser(userSession)) return;
    Object.assign(currentPreferences, newPreferences);

    if (!userSession.isLoaded) return;
    userSession.hasChanges = true;
    userSession.savePromise ??= Promise.resolve().then(() =>
      this.saveChanges(userSession, currentPreferences),
    );
    return userSession.savePromise;
  }

  private getUserSession(): PreferenceSession {
    const userId = this.loginService.user()?.userId ?? '';
    if (this.userSession?.userId !== userId) {
      const userSession: PreferenceSession = {
        userId,
        loadPromise: Promise.resolve({}),
        savePromise: null,
        hasChanges: false,
        isLoaded: false,
      };
      userSession.loadPromise = userId ? this.loadPreferences(userSession) : Promise.resolve({});
      this.userSession = userSession;
    }
    return this.userSession;
  }

  private isCurrentUser(userSession: PreferenceSession): boolean {
    return (
      userSession === this.userSession &&
      userSession.userId === (this.loginService.user()?.userId ?? '')
    );
  }

  private async loadPreferences(userSession: PreferenceSession): Promise<StoredPreferences> {
    try {
      const preferenceResponse = await resourceRequest(this.injector, (abortSignal) =>
        apiRequest(
          this.api.call<Array<{ pref?: string }>>(
            `call esms_m.a_user_pref_load(${sqlString(userSession.userId)});`,
          ),
          abortSignal,
        ),
      );
      if (preferenceResponse?.status !== 'PASS' || !Array.isArray(preferenceResponse.message))
        return {};
      const preferencesJson = preferenceResponse.message[0]?.pref;
      const parsedPreferences: unknown = preferencesJson ? JSON.parse(preferencesJson) : [];
      if (!Array.isArray(parsedPreferences)) return {};
      const storedPreferences: unknown = parsedPreferences[0];
      if (storedPreferences !== undefined && !isRecord(storedPreferences)) return {};
      userSession.isLoaded = true;
      return storedPreferences ?? {};
    } catch {
      return {};
    }
  }

  private async saveChanges(
    userSession: PreferenceSession,
    currentPreferences: StoredPreferences,
  ): Promise<void> {
    if (!userSession.hasChanges || !this.isCurrentUser(userSession)) {
      userSession.savePromise = null;
      return;
    }
    userSession.hasChanges = false;
    const preferencesToSave = { ...currentPreferences };
    NON_PERSISTENT_PREFERENCE_KEYS.forEach(
      (preferenceKey) => delete preferencesToSave[preferenceKey],
    );
    const saveQuery = `call esms_m.a_user_pref_insert(${sqlString(userSession.userId)}, ${sqlString(JSON.stringify([preferencesToSave]))});`;
    try {
      await apiRequest(this.api.write(saveQuery));
    } catch {}

    return this.saveChanges(userSession, currentPreferences);
  }
}
