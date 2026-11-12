import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api/api.service';
import { LoginService } from '../core/auth/login.service';
import { formatDateTime } from './dates';

@Injectable()
export class ReportData<T> {
  private readonly api = inject(ApiService);
  private readonly loginService = inject(LoginService);
  private latestRequest = 0;

  readonly rows = signal<T[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly loadedAt = signal<Date | null>(null);

  readonly asOn = computed(() => {
    const loadedAt = this.loadedAt();
    return loadedAt ? formatDateTime(loadedAt) : '';
  });

  readonly userId = computed(() => this.loginService.user()?.userId ?? '');

  async load(sql: string, prepare: (rows: T[]) => T[] = (rows) => rows): Promise<void> {
    const request = ++this.latestRequest;
    const isLatest = () => request === this.latestRequest;

    this.loading.set(true);
    this.error.set('');

    try {
      const result = await firstValueFrom(this.api.call<T[]>(sql));
      if (!isLatest()) {
        return;
      }
      if (result?.status === 'PASS' && Array.isArray(result.message)) {
        this.rows.set(prepare(result.message));
      } else {
        const serverMessage = typeof result?.message === 'string' ? result.message : '';
        this.showError(serverMessage || 'No data found.');
      }
    } catch {
      if (isLatest()) {
        this.showError('Unable to load the report. Please refresh to try again.');
      }
    } finally {
      if (isLatest()) {
        this.loading.set(false);
        this.loadedAt.set(new Date());
      }
    }
  }

  fail(message: string): void {
    this.latestRequest++;
    this.loading.set(false);
    this.showError(message);
  }

  private showError(message: string): void {
    this.rows.set([]);
    this.error.set(message);
  }
}
