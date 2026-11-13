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

  async load(
    procedureCall: string,
    transformRows: (rows: T[]) => T[] = (rows) => rows,
  ): Promise<void> {
    const requestId = ++this.latestRequest;
    const isCurrentRequest = () => requestId === this.latestRequest;

    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(this.api.call<T[]>(procedureCall));
      if (!isCurrentRequest()) {
        return;
      }
      if (response?.status === 'PASS' && Array.isArray(response.message)) {
        this.rows.set(transformRows(response.message));
      } else {
        const serverMessage = typeof response?.message === 'string' ? response.message : '';
        this.showError(serverMessage || 'No data found.');
      }
    } catch {
      if (isCurrentRequest()) {
        this.showError('Unable to load the report. Please refresh to try again.');
      }
    } finally {
      if (isCurrentRequest()) {
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
