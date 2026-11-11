import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, timeout } from 'rxjs';
import { ApiResult, MenuDefinition, ServerConfig, Setting } from '../models';

const TIMEOUT_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private baseUrl = '';
  private settings: Setting[] = [];

  centralized = false;
  centralMenus: MenuDefinition[] = [];

  async loadSettings(): Promise<void> {
    const [config] = await this.loadAsset<ServerConfig[]>('assets/config.json');

    if (!config?.NODE_IP || !config.NODE_PORT) {
      throw new Error('Invalid assets/config.json');
    }
    
    this.baseUrl = `${config.NODE_IP}:${config.NODE_PORT}/`;
    this.centralized = config.CENTRALIZED === true || config.CENTRALIZED === 'true';

    if (!this.centralized) {
      this.settings = await this.loadAsset<Setting[]>('assets/settings.json');
      return;
    }

    const reply = await firstValueFrom(
      this.post<{ settingsData: Setting[]; menuData: MenuDefinition[] }>('web_report_config', {}),
    );
    if (reply.status !== 'PASS' || !Array.isArray(reply.message?.settingsData)) {
      throw new Error('Unable to load centralized application settings');
    }
    this.settings = reply.message.settingsData;
    this.centralMenus = reply.message.menuData;
  }

  getSetting(name: string): string {
    return this.settings.find((setting) => setting._DESC === name)?._VALUE ?? '';
  }

  post<T>(endpoint: string, body: object): Observable<ApiResult<T>> {
    return this.http
      .post<ApiResult<T>>(this.baseUrl + endpoint, body)
      .pipe(timeout(TIMEOUT_MS));
  }

  query<T>(sql: string): Observable<ApiResult<T>> {
    return this.post<T>('post_view_query', { sql });
  }

  /** Runs a stored procedure, e.g. "call esms_m.r_organization_grid(...)". Quote inputs with `sqlString()`. */
  call<T>(sql: string): Observable<ApiResult<T>> {
    return this.post<T>('post_view_call', { sql });
  }

  /** Runs a statement or procedure that changes data, e.g. saving preferences. */
  write<T>(sql: string): Observable<ApiResult<T>> {
    return this.post<T>('post_insert_update', { sql });
  }

  loadAsset<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(path).pipe(timeout(TIMEOUT_MS)));
  }
}

export function sqlString(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
}
