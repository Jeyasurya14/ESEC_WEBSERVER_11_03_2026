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

/**
 * Every migrated report, keyed by `mainMenuName/subMenuName`. Each entry is a plain dynamic
 * `import()`, so Angular builds it into its own chunk and only downloads it the first time
 * someone opens that report. Add a new report by adding one line here.
 */
const REPORT_ENTRIES: ReadonlyArray<[string, () => Promise<Type<unknown>>]> = [
  [
    'LICENSE/Organization',
    () => import('./license/organization/organization').then((m) => m.Organization),
  ],
  ['LICENSE/Division', () => import('./license/division/division').then((m) => m.Division)],
];

export const REPORTS = new Map<string, () => Promise<Type<unknown>>>(REPORT_ENTRIES);

/**
 * Catches a copy-pasted key: `Map` would otherwise just keep the last one and drop the rest
 * silently, which is easy to miss as more reports are added here over time.
 */
export function assertNoDuplicateReportKeys(entries: ReadonlyArray<[string, unknown]>): void {
  const uniqueKeys = new Set(entries.map(([key]) => key));
  if (uniqueKeys.size !== entries.length) {
    throw new Error('reports.ts registers the same report key twice - check REPORT_ENTRIES.');
  }
}

assertNoDuplicateReportKeys(REPORT_ENTRIES);

/** Set for one page load, right after we reload to recover from a failed report chunk. */
const RELOADED_AFTER_LOAD_FAILURE = 'esec:reloaded-after-report-load-failure';

/**
 * Loads the component for `menu`, or the placeholder if that screen has not been migrated yet.
 *
 * A report's chunk can fail to download after a new version of the app is deployed: a browser
 * tab left open from before the deploy still asks for the old build's file, which the server no
 * longer has. Reloading the page fetches the current build and fixes this, so we do that once;
 * a flag in `sessionStorage` stops a second, genuine failure from reloading forever.
 */
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
