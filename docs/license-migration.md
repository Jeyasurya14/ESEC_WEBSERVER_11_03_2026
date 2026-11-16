# License sidebar migration

Source: `D:\ESEC_WEBSERVER_CODE_GEN_5_AUG_2025`.
Destination: `D:\esec_latest_21`.

The source menu is defined in `src/assets/menu.json`. License clicks are dispatched by
`src/app/containers/SRC_MENU/SUMMARY/SRC_MENU_SUMMARY.ts`; the source `LICENSE MANAGER`
menu is a separate module. This migration covers the 16 screens under **LICENSE**.

## Screen mapping

Every screen below is registered in `src/app/reports/report-registry.ts` and opens a standalone
Angular report. The existing menu catalog and permission resolution still determine which
screens each signed-in user can see.

| License screen             | Implementation                       | Backend contract                                               |
| -------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| Organization               | `license/organization`               | `r_organization_grid` and its month, quarter, year variants    |
| Organization By Week       | `license/organization-week`          | `r_organization_week_report`, `r_load_holiday_list`            |
| Organization By Year Month | `license/organization-year-month`    | `r_organization_year_month_1_server`, `_2_server`, `_3_server` |
| Division                   | `license/division`, shared summary   | `r_division_grid` and range variants                           |
| Department                 | `license/department`, shared summary | `r_department_grid` and range variants                         |
| Group                      | `license/group`, shared summary      | `r_group_grid` and range variants                              |
| My Feature                 | `license/my-feature`                 | `R_A_CLTX_ESEC_MF_*` list/create/add/remove/delete procedures  |
| Report Type 1              | `license/report-type-one`            | `r_report_view_1_*` parameter/report/session procedures        |
| Denial                     | `license/denial`                     | `r_denial_grid` and range variants                             |
| Borrow                     | `license/borrow`                     | `r_borrow_grid` and range variants                             |
| Usage                      | `license/usage`                      | `r_license_usage_sw_list`, `r_license_usage_sw`                |
| User                       | `license/user`                       | `r_license_user`                                               |
| Computer                   | `license/computer`                   | `r_license_wksn`                                               |
| Group Member               | `license/group-member`               | `r_license_group_member`                                       |
| License and Agent Combined | `license/license-agent-combined`     | `r_license_agent_sw_list` (`sw_name`), `r_license_agent_sw`    |
| Debug Data                 | `license/debug-data`                 | `r_license_debug_data`, `r_license_debug_data_1`               |

## Behavior and design

- Organization, Division, Department and Group share the current project's filters, grid/gauge
  switch, usage colors and workspace drilldown behavior. Their main queries remain separate.
- Division, Department and Group drilldowns keep their scope fields. Scoped utilization supports
  date/week/month/quarter/year, heatmap supports peak/average, and hours supports date/month.
  Checkout, checkout counts, long duration, denial and borrow use their scoped source procedures.
  Division also opens departments; Group opens date and member usage.
- Year/month comparison supports multiple years, a month range, and a year versus a month.
  Issued quantities, selected usage metric, percentages and user counts are pivoted by period.
- Usage loads only after selecting software. Its matrix views aggregate by software, server,
  feature and division/department/group/cluster; percentages use the corresponding usage total.
- Report Type 1 supports feature selection, consolidated/server detail queries, utilization,
  merge, percentile, denial, borrow, usage, license month, dashboard, group, date, checkout,
  long duration and daywise usage. Sessions use the source load/save/delete procedures.
- My Feature retains the feature editor and opens selected group reports through the shared
  Report Type 1 engine. Compare opens server details in chart view. System groups are read-only.
- Debug Data opens a second grid for the selected license's records and date range.
- New reports register workspace refresh controls. Clearing selections invalidates pending
  requests; a late response cannot repopulate a cleared report.
- Feature-group changes invalidate the cached dropdown lists in other reports.

## Adaptations from the legacy UI

The implementation uses the current project's standalone components, Signals, shared filters,
AG Grid wrapper and Highcharts. Legacy Material dialogs, global subjects, timing-based
initialization, and component-specific grid configuration are not copied.

Some legacy tree reports are presented as flat grids with explicit grouping/detail selectors.
My Feature report views share Report Type 1's feature-selection queries instead of maintaining
a second family of configuration-dashboard components. Chart views expose the returned numeric
metrics; the legacy chart layouts and every nested chart control are not reproduced pixel for pixel.
Legacy URL-share links and specialized MSCONE workflows are outside this migration.

## Verification

- `npm test -- --watch=false`: registry rendering, existing reports and new API/data contracts.
- `npm run build -- --configuration development` and `npm run build`: Angular template/type and bundle checks.
- Tests use controlled API responses. No live customer records or persisted company data were
  changed during implementation. Live queries, installation-specific result schemas, session
  writes and user permissions should be verified in an authenticated company environment.

Suggested acceptance check: open each permitted License screen, select a real date range, switch
grid/gauge, select a scoped drilldown, compare two periods, select software in Usage and Combined,
save/reload a test report session, and open a Debug Data record. Verify figures against the legacy
app using identical filters and working-hour settings.
