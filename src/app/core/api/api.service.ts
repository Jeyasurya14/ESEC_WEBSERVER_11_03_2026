import { namedValues } from '../utils/data';
import { apiRequest } from './api-request';
import { Injectable, inject, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { ApiResult, MenuDefinition, ServerConfig, Setting } from '../models';

const TIMEOUT_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly http = inject(HttpClient);
  private serverUrl = '';
  private appSettings = new Map<string, string>();

  isCentralized = false;
  centralMenus: MenuDefinition[] = [];

  async loadSettings(): Promise<void> {
    const [config] = await this.loadAsset<ServerConfig[]>('assets/config.json');

    if (!config?.NODE_IP || !config.NODE_PORT) {
      throw new Error('Invalid assets/config.json');
    }

    this.serverUrl = `${config.NODE_IP}:${config.NODE_PORT}/`;
    this.isCentralized = config.CENTRALIZED === true || config.CENTRALIZED === 'true';

    if (!this.isCentralized) {
      const settings = await this.loadAsset<Setting[]>('assets/settings.json');
      this.appSettings = namedValues(settings);
      return;
    }

    const configResponse = await apiRequest(
      this.post<{ settingsData: Setting[]; menuData: MenuDefinition[] }>('web_report_config', {}),
      this.destroyRef,
    );
    if (configResponse.status !== 'PASS' || !Array.isArray(configResponse.message?.settingsData)) {
      throw new Error('Unable to load centralized application settings');
    }
    this.appSettings = namedValues(configResponse.message.settingsData);
    this.centralMenus = configResponse.message.menuData;
  }

  getSetting(settingName: string): string {
    return this.appSettings.get(settingName) ?? '';
  }

  post<T>(endpoint: string, body: object): Observable<ApiResult<T>> {
    return this.http.post<ApiResult<T>>(this.serverUrl + endpoint, body).pipe(timeout(TIMEOUT_MS));
  }

  query<T>(sql: string): Observable<ApiResult<T>> {
    return this.post<T>('post_view_query', { sql });
  }

  call<T>(sql: string): Observable<ApiResult<T>> {
    return this.post<T>('post_view_call', { sql });
  }

  write<T>(sql: string): Observable<ApiResult<T>> {
    return this.post<T>('post_insert_update', { sql });
  }

  /** Posts `sql` to a write endpoint; rejects with the server's text, else `failedMessage`. */
  async send(endpoint: string, sql: string | string[], failedMessage: string): Promise<void> {
    const response = await apiRequest(this.post<unknown>(endpoint, { sql }), this.destroyRef);
    if (response?.status !== 'PASS') {
      throw new Error(
        typeof response?.message === 'string' && response.message
          ? response.message
          : failedMessage,
      );
    }
  }

  loadAsset<T>(path: string): Promise<T> {
    return apiRequest(this.http.get<T>(path).pipe(timeout(TIMEOUT_MS)), this.destroyRef);
  }
}

export function sqlString(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
}
