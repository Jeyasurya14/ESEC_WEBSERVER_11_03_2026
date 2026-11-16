import { ChangeDetectionStrategy, Component, Type, input } from '@angular/core';
import { UserMenu } from '../core/models';

@Component({
  selector: 'app-report-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    () =>
      import('./license/organization/organization').then(
        (reportModule) => reportModule.Organization,
      ),
  ],
  [
    'LICENSE/Division',
    () => import('./license/division/division').then((reportModule) => reportModule.Division),
  ],
  [
    'LICENSE/Department',
    () => import('./license/department/department').then((reportModule) => reportModule.Department),
  ],
  [
    'LICENSE/Group',
    () => import('./license/group/group').then((reportModule) => reportModule.Group),
  ],
  [
    'LICENSE/Organization By Week',
    () =>
      import('./license/organization-week/organization-week').then(
        (reportModule) => reportModule.OrganizationWeek,
      ),
  ],
  [
    'LICENSE/Organization By Year Month',
    () =>
      import('./license/organization-comparison/organization-comparison').then(
        (reportModule) => reportModule.OrganizationComparison,
      ),
  ],
  [
    'LICENSE/My Feature',
    () =>
      import('./license/feature-groups/feature-groups').then(
        (reportModule) => reportModule.FeatureGroups,
      ),
  ],
  [
    'LICENSE/Report Type 1',
    () =>
      import('./license/custom-report/custom-report').then(
        (reportModule) => reportModule.CustomReport,
      ),
  ],
  [
    'LICENSE/Denial',
    () => import('./license/denial/denial').then((reportModule) => reportModule.Denial),
  ],
  [
    'LICENSE/Borrow',
    () => import('./license/borrow/borrow').then((reportModule) => reportModule.Borrow),
  ],
  [
    'LICENSE/Usage',
    () => import('./license/usage/usage').then((reportModule) => reportModule.Usage),
  ],
  ['LICENSE/User', () => import('./license/user/user').then((reportModule) => reportModule.User)],
  [
    'LICENSE/Computer',
    () => import('./license/computer/computer').then((reportModule) => reportModule.Computer),
  ],
  [
    'LICENSE/Group Member',
    () =>
      import('./license/group-member/group-member').then(
        (reportModule) => reportModule.GroupMember,
      ),
  ],
  [
    'LICENSE/License and Agent Combined',
    () =>
      import('./license/license-agent/license-agent').then(
        (reportModule) => reportModule.LicenseAgent,
      ),
  ],
  [
    'LICENSE/Debug Data',
    () => import('./license/debug-data/debug-data').then((reportModule) => reportModule.DebugData),
  ],
];

export const REPORT_LOADERS = new Map<string, () => Promise<Type<unknown>>>(REPORT_ENTRIES);

export function assertNoDuplicateReportKeys(reportEntries: ReadonlyArray<[string, unknown]>): void {
  const uniqueReportKeys = new Set(reportEntries.map(([reportKey]) => reportKey));
  if (uniqueReportKeys.size !== reportEntries.length) {
    throw new Error(
      'report-registry.ts registers the same report key twice - check REPORT_ENTRIES.',
    );
  }
}

assertNoDuplicateReportKeys(REPORT_ENTRIES);

const RELOADED_AFTER_LOAD_FAILURE = 'esec:reloaded-after-report-load-failure';

export async function loadReport(menu: UserMenu): Promise<Type<unknown>> {
  const reportLoader = REPORT_LOADERS.get(`${menu.mainMenuName}/${menu.subMenuName}`);
  if (!reportLoader) {
    return ReportPlaceholderComponent;
  }

  try {
    const component = await reportLoader();
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
