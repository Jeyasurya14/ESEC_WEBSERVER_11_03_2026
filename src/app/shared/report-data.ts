import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiService } from '../core/api/api.service';
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

/**
 * When a report built from several data sources last fully loaded: the oldest source's load
 * time, or '' while any source is loading, failed, or hasn't loaded yet.
 */
export function combinedLastUpdated(
  sources: readonly Pick<ReportData<unknown>, 'loading' | 'error' | 'loadedAt'>[],
): string {
  const loadTimes: number[] = [];
  for (const source of sources) {
    const loadedAt = source.loadedAt();
    if (source.loading() || source.error() || !loadedAt) return '';
    loadTimes.push(loadedAt.getTime());
  }
  return loadTimes.length ? formatDateTime(new Date(Math.min(...loadTimes))) : '';
}

/**
 * One report's rows, loaded from whatever query the report binds. Provide it per report
 * (or create one with `new` in an injection context for a second, independent data source).
 */
@Injectable()
export class ReportData<T> {
  private readonly api = inject(ApiService);
  private readonly loginService = inject(LoginService);
  private readonly query = signal<() => ReportQuery<T> | undefined>(() => undefined);

  // rxResource unsubscribes a superseded request when the query changes, cancelling it.
  private readonly result = rxResource({
    params: () => this.query()(),
    defaultValue: { kind: 'initial', rows: [] } satisfies ReportState<T>,
    stream: ({ params }): Observable<ReportState<T>> => {
      switch (params.kind) {
        case 'idle':
          return of({ kind: 'empty', rows: [] });
        case 'invalid':
          return of({ kind: 'error', rows: [], message: params.message });
        case 'load':
          return this.fetch(params.sql, params.transform ?? ((rows) => rows));
        default:
          return assertNever(params);
      }
    },
  });

  private readonly state = computed(() =>
    this.result.hasValue() ? this.result.value() : undefined,
  );
  readonly rows = computed(() => this.state()?.rows ?? []);
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

  /** Loads whatever `query` declares, again whenever a signal it reads changes. Call once. */
  bind(query: () => ReportQuery<T> | undefined): void {
    this.query.set(query);
  }

  /** Re-runs the current query; unlike a query change, the rows stay on screen meanwhile. */
  refresh(): void {
    this.result.reload();
  }

  /** Shows an error that isn't from a query, e.g. the report's settings failing to load. */
  fail(message: string): void {
    this.result.set({ kind: 'error', rows: [], message });
  }

  private fetch(sql: string, transform: (rows: T[]) => T[]): Observable<ReportState<T>> {
    return this.api.call<T[]>(sql).pipe(
      map((response): ReportState<T> => {
        if (response.status !== 'PASS' || !Array.isArray(response.message)) {
          return {
            kind: 'error',
            rows: [],
            message: typeof response.message === 'string' ? response.message : 'No data found.',
          };
        }
        return { kind: 'ready', rows: transform(response.message), loadedAt: new Date() };
      }),
      catchError(() =>
        of<ReportState<T>>({
          kind: 'error',
          rows: [],
          message: 'Unable to load the report. Please refresh to try again.',
        }),
      ),
    );
  }
}
