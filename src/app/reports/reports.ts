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

export const REPORTS = new Map<string, () => Promise<Type<unknown>>>([
  [
    'LICENSE/Organization',
    () => import('./license/organization/organization').then((m) => m.Organization),
  ],
  ['LICENSE/Division', () => import('./license/division/division').then((m) => m.Division)],
]);

export function loadReport(menu: UserMenu): Promise<Type<unknown>> {
  const loader = REPORTS.get(`${menu.mainMenuName}/${menu.subMenuName}`);
  return loader ? loader() : Promise.resolve(ReportPlaceholderComponent);
}
