import { Component, Type, input } from '@angular/core';
import { UserMenu } from '../core/models';

@Component({
  selector: 'app-report-placeholder',
  styles: ':host { display: block; padding: 16px; }',
  template: `
    <h1>{{ menu().mainMenuName }} / {{ menu().subMenuName }}</h1>
    <p>This report page has not been migrated to Angular 21 yet.</p>
  `,
})
export class ReportPlaceholderComponent {
  readonly menu = input.required<UserMenu>();
}

const REPORT_ENTRIES: ReadonlyArray<[string, () => Promise<Type<unknown>>]> = [
  [
    'LICENSE/Organization',
    () => import('./license/organization/organization').then((m) => m.Organization),
  ],
  ['LICENSE/Division', () => import('./license/division/division').then((m) => m.Division)],
];

export const REPORTS = new Map<string, () => Promise<Type<unknown>>>(REPORT_ENTRIES);

export function assertNoDuplicateReportKeys(entries: ReadonlyArray<[string, unknown]>): void {
  const uniqueKeys = new Set(entries.map(([key]) => key));
  if (uniqueKeys.size !== entries.length) {
    throw new Error('reports.ts registers the same report key twice - check REPORT_ENTRIES.');
  }
}

assertNoDuplicateReportKeys(REPORT_ENTRIES);

const RELOADED_AFTER_LOAD_FAILURE = 'esec:reloaded-after-report-load-failure';

export async function loadReport(menu: UserMenu): Promise<Type<unknown>> {
  const loader = REPORTS.get(`${menu.mainMenuName}/${menu.subMenuName}`);
  if (!loader) {
    return ReportPlaceholderComponent;
  }

  try {
    const component = await loader();
    sessionStorage.removeItem(RELOADED_AFTER_LOAD_FAILURE);
    return component;
  } catch (error) {
    if (!sessionStorage.getItem(RELOADED_AFTER_LOAD_FAILURE)) {
      sessionStorage.setItem(RELOADED_AFTER_LOAD_FAILURE, 'true');
      window.location.reload();
    }
    throw error;
  }
}
