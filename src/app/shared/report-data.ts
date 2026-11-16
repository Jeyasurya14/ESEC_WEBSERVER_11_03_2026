import { DestroyRef, Injectable, computed, effect, inject, resource, signal } from '@angular/core';
import { ApiService } from '../core/api/api.service';
import { apiRequest } from '../core/api/api-request';
import { LoginService } from '../core/auth/login.service';
import { assertNever } from '../core/utils/data';
import { formatDateTime } from './dates';

type ReportState<T> = { rows: T[] } & (
  | { kind: 'initial' }
  | { kind: 'ready'; loadedAt: Date }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
);

/**
 * What a report declares it wants on screen, derived from its own signals. `undefined` from a
 * bound query means its prerequisites (e.g. settings) aren't ready, so the report stays loading.
 */
export type ReportQuery<T> =
  | { kind: 'load'; sql: string; transform?: (rows: T[]) => T[] }
  | { kind: 'invalid'; message: string }
  | { kind: 'idle' };

/** A query from SQL that may be missing, e.g. because the user's dates are invalid. */
export function sqlQuery<T>(sql: string | null, whenMissing: ReportQuery<T>): ReportQuery<T> {
  return sql ? { kind: 'load', sql } : whenMissing;
}

interface ReportRequest<T> {
  sql: string;
  previousRows: T[];
  transform: (rows: T[]) => T[];
  complete: () => void;
}

interface ReportParams<T> {
  query: ReportQuery<T>;
  complete?: () => void;
}

@Injectable()
export class ReportData<T> {
  private readonly api = inject(ApiService);
  private readonly loginService = inject(LoginService);
  private readonly request = signal<ReportRequest<T> | undefined>(undefined);
  private readonly binding = signal<(() => ReportQuery<T> | undefined) | null>(null);
  private readonly params = computed<ReportParams<T> | undefined>(() => {
    const binding = this.binding();
    if (binding) {
      const query = binding();
      return query && { query };
    }
    const request = this.request();
    if (!request) return undefined;
    return {
      query: { kind: 'load', sql: request.sql, transform: request.transform },
      complete: request.complete,
    };
  });
  private destroyed = false;
  private readonly result = resource({
    params: this.params,
    defaultValue: { kind: 'initial', rows: [] } satisfies ReportState<T>,
    loader: async ({ params, abortSignal }): Promise<ReportState<T>> => {
      const { query } = params;
      switch (query.kind) {
        case 'idle':
          return { kind: 'empty', rows: [] };
        case 'invalid':
          return { kind: 'error', rows: [], message: query.message };
        case 'load':
          return this.fetch(query.sql, query.transform ?? ((rows) => rows), abortSignal);
        default:
          return assertNever(query);
      }
    },
  });
  private readonly state = computed(() =>
    this.result.hasValue() ? this.result.value() : undefined,
  );
  readonly rows = computed(() => this.state()?.rows ?? this.request()?.previousRows ?? []);
  readonly loading = computed(() => this.result.isLoading() || this.state()?.kind === 'initial');
  readonly error = computed(() => {
    const state = this.state();
    if (!state) return '';
    switch (state.kind) {
      case 'error':
        return state.message;
      case 'initial':
      case 'ready':
      case 'empty':
        return '';
      default:
        return assertNever(state);
    }
  });
  readonly loadedAt = computed(() => {
    const state = this.state();
    return state?.kind === 'ready' ? state.loadedAt : null;
  });
  readonly lastUpdated = computed(() => {
    const loadedAt = this.loadedAt();
    return loadedAt ? formatDateTime(loadedAt) : '';
  });
  readonly userId = computed(() => this.loginService.user()?.userId ?? '');

  constructor() {
    effect(() => {
      const request = this.request();
      if (request && !this.result.isLoading()) {
        request.previousRows = [];
        request.complete();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.request()?.complete();
    });
  }

  /**
   * Loads whatever `query` declares, and again whenever a signal it reads changes - the
   * declarative alternative to calling `load()` from an effect. Call once, in the constructor.
   */
  bind(query: () => ReportQuery<T> | undefined): void {
    this.binding.set(query);
  }

  /** Re-runs the current query; unlike a query change, the rows stay on screen meanwhile. */
  refresh(): void {
    this.result.reload();
  }

  load(sql: string, transform: (rows: T[]) => T[] = (rows) => rows): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    const previousRows = this.rows();
    this.request()?.complete();
    const completion = Promise.withResolvers<void>();
    this.request.set({ sql, transform, previousRows, complete: () => completion.resolve() });
    return completion.promise;
  }

  fail(message: string): void {
    this.reset({ kind: 'error', rows: [], message });
  }

  clear(): void {
    this.reset({ kind: 'empty', rows: [] });
  }

  private async fetch(
    sql: string,
    transform: (rows: T[]) => T[],
    abortSignal: AbortSignal,
  ): Promise<ReportState<T>> {
    try {
      const response = await apiRequest(this.api.call<T[]>(sql), abortSignal);
      if (response.status !== 'PASS' || !Array.isArray(response.message)) {
        return {
          kind: 'error',
          rows: [],
          message: typeof response.message === 'string' ? response.message : 'No data found.',
        };
      }
      return { kind: 'ready', rows: transform(response.message), loadedAt: new Date() };
    } catch (error: unknown) {
      if (abortSignal.aborted) throw error;
      return {
        kind: 'error',
        rows: [],
        message: 'Unable to load the report. Please refresh to try again.',
      };
    }
  }

  private reset(state: ReportState<T>): void {
    this.request()?.complete();
    this.request.set(undefined);
    this.result.set(state);
  }
}
