import { Component, Type, input } from '@angular/core';
import { UserMenu } from '../models';

/**
 * Every report component can declare `menu = input<UserMenu>()`; the tab passes in the
 * menu entry the report was opened from.
 */
@Component({
  selector: 'app-report-placeholder',
  template: `
    <h1>{{ menu().mainMenuName }} / {{ menu().subMenuName }}</h1>
    <p>This report page has not been migrated to Angular 21 yet.</p>
  `,
})
export class ReportPlaceholderComponent {
  readonly menu = input.required<UserMenu>();
}

type ReportLoader = () => Promise<Type<unknown>>;

/**
 * Which component a menu entry opens, loaded on demand so each report is its own chunk.
 * To migrate a report, add one line:
 *   ['DASHBOARD/Configuration', () => import('../reports/configuration.component').then((m) => m.ConfigurationComponent)],
 * Entries not listed here open the placeholder.
 */
const REPORTS = new Map<string, ReportLoader>([]);

export function loadReport(menu: UserMenu): Promise<Type<unknown>> {
  const loader = REPORTS.get(`${menu.mainMenuName}/${menu.subMenuName}`);
  return loader ? loader() : Promise.resolve(ReportPlaceholderComponent);
}
