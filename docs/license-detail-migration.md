# Organization bottom reports: source analysis and implementation

Source: `D:\ESEC_WEBSERVER_CODE_GEN_5_AUG_2025\src\app\ev3-components`.
The Organization `treeViewMenuClick` and `load...` methods were traced into each destination
component, its HTML controls, stored procedures and nested report components. Existing Summary
behavior is documented separately in [license-summary.md](license-summary.md).

## Report-by-report mapping

| Report                | Company component                                                | Implemented behavior                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Utilization           | `ev3-dashboard-summary/ev3-dash-sum-day`                         | Date, Week, Month, Quarter, Year and Scatter queries; time window; Value/Percentage; eight metrics and Issued; working-day display filtering; chart/grid layouts; labels and overlap                          |
| History               | `ev3-lic-organization/ev3-lic-org-history`                       | Date range, working days and reduction; cumulative usage levels; percentile and capacity markers; separate `_history_1` data-point/100% utilization grid                                                      |
| QOS                   | `ev3-lic-organization/ev3-lic-org-qos`                           | Days/Data Points category; 24-hour/business-time modes; holidays/reduction; actual/linear levels; 2nd/3rd/4th-order polynomial comparisons; percentile/capacity markers; separate `_qos_1` usage distribution |
| Heatmap               | `ev3-lic-organization/ev3-utilization/ev3-lic-org-utilz-hour`    | Date range; Peak/Avg; working days; min/max display range; zero visibility; Issued/Used cell labels; configured percentage color bands; chart/grid layouts                                                    |
| Month                 | `ev3-lic-organization/ev3-month`                                 | Date range, hours per day and working-day flags; original grouped columns and additional returned fields                                                                                                      |
| Date                  | `ev3-lic-organization/ev3-lic-org-date`                          | Date range; original columns; available-hours scaling and license-hours percentage calculated without mutating responses                                                                                      |
| Hours                 | `ev3-utilization/hoursused/ev3-hrs-hoursused`                    | Month/Date modes, hours per day, monthly working-day flag; shared grid/chart response and layout controls                                                                                                     |
| Usage                 | `ev3-lic-usage` and its Summary/Daywise/Session/Matrix children  | Summary, Daywise Summary, Daywise Session and Matrix; working days; grouping by Division/Department/Group/Computer; user links and user filtering; grouped-user drilldown                                     |
| Utilization and Hours | `ev3-addon-license/ev3-float-lic-utilz`                          | Separate user-grid and Date/Month chart queries; business hours; holidays; new monthly calculation; grouped-user details; distinct users and available/used-hours totals                                      |
| Checkout User         | `ev3-lic-organization/ev3-users/ev3-lic-org-users-longduration`  | Date and Date/Time procedure modes, date/time controls, full checkout columns and additional returned fields                                                                                                  |
| Checkout Count        | `ev3-lic-organization/ev3-users/ev3-lic-org-users-checkout-date` | Date/time controls; working-day display filtering; Issued line and Count columns on separate axes; chart/grid layouts                                                                                         |
| Long Duration         | Same component as Checkout User                                  | Duration-threshold query with editable hours and date range                                                                                                                                                   |
| Denial                | `ev3-lic-organization/ev3-users/ev3-lic-org-users-denial`        | Date range, user/site columns, search, grid filters and exports                                                                                                                                               |
| Borrow                | `ev3-lic-organization/ev3-users/ev3-lic-org-users-borrow`        | Date range, borrow/user columns, search, filters and exports                                                                                                                                                  |
| Divn                  | `ev3-license/ev3-lic-division`                                   | Full scoped grid/gauge screen, period/option/expiry/band filters and its bottom drilldowns                                                                                                                    |
| Dept                  | `ev3-license/ev3-lic-department`                                 | Full scoped grid/gauge screen, calendar periods, filters and Department drilldowns                                                                                                                            |
| Reservation           | `ev3-license/ev3-lic-group`                                      | Full reservation-group grid/gauge screen, calendar periods, filters and Group drilldowns                                                                                                                      |
| Asset Info            | `ag-templates/ag-asset-info`                                     | Server/date context, 24-hour/business-hour flags and holiday flags; original asset columns plus all extra returned columns                                                                                    |
| Debug Data            | `ev3-lic-debug-feature`                                          | Date filters, complete returned audit fields, clickable license and a second session-details grid using the clicked row identity                                                                              |
| Bundle                | `bundle`                                                         | Prefix selection, Common/Uncommon comparison, per-bundle Issued/Peak columns, Sum columns, search and pinned distinct-server counts                                                                           |

The navigation registry opens the shared `LicenseDetail` workspace directly with a typed view id, selected row, range and settings. Divn/Dept/Reservation reuse the existing Division, Department and Group components with an explicit parent row. `LicenseBundle` owns the client-side matrix. Shared columns live under `detail/columns`; canonical queries remain in `detail/detail-queries.ts`.

## Procedure contracts

All dates are validated and serialized as `YYYY-MM-DD`. Procedure names are selected by typed
report/mode values; user-entered dates, identities and numeric values are escaped as SQL literals.

| Report/mode                 | Procedure                                                 | Arguments after server/license                                                    |
| --------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Utilization                 | `r_organization_utilization_date/week/month/qtr/year`     | start date, end date, start time, end time                                        |
| Utilization Scatter         | `r_organization_utilization_scatter`                      | start date, end date, `y`                                                         |
| History                     | `r_organization_history`                                  | start date, end date, holiday key, reduction                                      |
| History points              | `r_organization_history_1`                                | start date, end date, holiday key                                                 |
| QOS                         | `r_organization_qos`                                      | category, hour key, holiday key, reduction, dates, times                          |
| QOS usage                   | `r_organization_qos_1`                                    | hour key, holiday key, reduction, dates                                           |
| Heatmap                     | `r_organization_utilization_hour`                         | start date, end date                                                              |
| Month                       | `r_organization_month`                                    | dates, working hours, holiday-exclusion key                                       |
| Date                        | `r_organization_date`                                     | start date, end date                                                              |
| Hours Date                  | `r_organization_usage_date`                               | dates, working hours                                                              |
| Hours Month                 | `r_organization_usage_month`                              | dates, working hours, holiday-exclusion key                                       |
| Usage Summary/Matrix        | `r_organization_usage`                                    | Uses server, `All`, dates, holiday key; selected license filtered in the response |
| Usage Daywise/Session       | `r_organization_usage_1/_2`                               | Uses server, `All`, dates; selected license/user filtered in the response         |
| Utilization/Hours user grid | `r_organization_usage_utilization_date_2`                 | dates, holiday-exclusion key                                                      |
| Utilization/Hours chart     | `r_organization_usage_utilization_date_1/month_1/month_2` | dates, business-hour key, holiday-exclusion key                                   |
| Checkout User               | `r_organization_users_checkout_list_date`                 | dates                                                                             |
| Checkout Date/Time          | `r_organization_users_checkout_list_date_time`            | dates, times                                                                      |
| Checkout Count              | `r_organization_users_checkout_date`                      | dates, times                                                                      |
| Long Duration               | `r_organization_users_checkout_list_duration`             | dates, duration hours                                                             |
| Denial                      | `r_organization_users_denial_users`                       | dates                                                                             |
| Borrow                      | `r_organization_users_borrow`                             | dates                                                                             |
| Asset Info                  | `r_organization_utilization_asset_info`                   | Uses server, dates, business-hour key, holiday-exclusion key; no license argument |
| Debug Data                  | `r_organization_debug_data`                               | dates                                                                             |
| Debug sessions              | `r_license_debug_data_1`                                  | clicked server, clicked license, dates                                            |

The source uses different flag conventions. These are preserved per procedure family:

- History, QOS and Usage: working days use an empty holiday key; all days use `Y`.
- Month, Hours Month, Utilization/Hours and Asset Info: working days use `N`; all days use `Y`.
- Asset Info and Utilization/Hours business-hour key: `W`; full day: empty string.
- QOS business-hour key: empty string; full day: `24`. QOS category is `date` or empty string.
  Its full-day time arguments are `00:00` and `24:00`.

These correct earlier simplified helpers that passed times to Asset Info, used `Days` as the QOS
category, or reversed the holiday/exclusion flags. Compatibility query helpers and their tests
were updated alongside the shared workspace.

### Breakdown queries

The selected Organization server/license is passed as `parentRow`. Main sidebar reports continue
to use their original user-scoped queries. A breakdown uses
`r_organization_groups_division/department/group` with `_grid`, `_month_year`, `_qtr_year` or `_year`
according to the current range filter. Calendar suffixes replace `_grid`; they are not appended
after it. This removes the former fixed-30-day limitation.

## Calculations and local views

- Date available hours: returned `tlh_24 × workingHoursPerDay / 24`. Usage percentage is
  `tot_du_q / available × 100`, rounded to one decimal, with 0% for zero capacity.
- History/QOS cumulative levels use sorted values and binary search. Zero is counted separately,
  matching the source convention. Linear QOS curves are bounded to 5,000 display levels to keep
  large license counts from allocating enormous arrays.
- Percentiles use distinct returned usage levels, matching the company analysis. QOS ignores
  zero levels for that marker. Polynomial comparisons normalize quantities and use pivoted least
  squares, with safe handling for insufficient or singular data.
- Usage grouping sums hours/sessions and counts distinct users. Department and Group keys include
  their parent identities, so equal names in different divisions/group types do not merge.
- Matrix column labels are namespaced, preventing a group named `user_id` from replacing a user
  identity column. Calculations create new rows and do not mutate backend records.
- Utilization/Hours keeps grid data and chart data in separate requests, because the company uses
  different stored procedures for them. User/group selection uses the loaded user dataset.
- Heatmap colors continue to use percentage values when Issued/Used labels are shown.
- Bundle splits `lic_name` at its first underscore, compares selected bundle prefixes, intersects
  submodules for Common, and selects the remainder for Uncommon. It sums issued/peak quantities
  per module/bundle and counts distinct servers with positive issued quantities. The server-count
  row stays pinned above the module matrix. Empty prefix input shows all available bundles.

## Reuse and lifecycle

| File                                 | Responsibility                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `detail/detail-queries.ts`           | Report capabilities, typed parameters, validation and canonical query variants        |
| `detail/license-detail.ts/html/scss` | Shared date/time controls, report modes, local selections, requests and rendering     |
| `detail/detail-columns.ts`           | Original business columns, additional schema columns and clickable row links          |
| `detail/detail-charts.ts`            | White chart/plot surfaces, metric mappings, analysis plots, heatmap and local exports |
| `detail/usage-analysis.ts`           | Cumulative distributions, polynomial fitting, grouping and usage matrices             |
| `drilldown/breakdown-queries.ts`     | Calendar-aware Organization-to-scope breakdown queries                                |
| `bundle/bundle-matrix.ts`            | Pure client-side Bundle comparison and columns                                        |

Each opened report owns its primary/secondary data sources. Changing SQL cancels the previous
request; closing the tab unsubscribes every request. Validation prevents invalid calendars,
reversed ranges, malformed times and invalid duration/reduction numbers from reaching the API.
One workspace refresh handle reloads all active sources, with aggregate loading and successful
timestamps. Errors have Retry controls. Local metric, layout, polynomial, grouping and search
changes retain loaded data. Date/SQL mode changes fetch the appropriate procedure.

Charts reuse `ReportChart`; grids reuse `DataGrid`, including sorting, filtering and exports.
Chart exports are local, with server fallback disabled. The five duplicated chart style files
were removed after moving their layout into the shared workspace.

The new controls and layout are native to the current project. Company-shell sharing and legacy
IndexedDB restore hooks are not copied; report state is owned by each current workspace tab.

## Verification

Tests exercise every toolbar destination and instantiate every queried Organization report.
Additional contract tests cover all procedure families and mode-specific arguments, corrected
flags, invalid dates/times, calendar breakdown variants, analysis calculations, bounded linear
curves, polynomial fitting, grouping identity, Bundle comparison and non-mutating calculations.
Component tests exercise period changes, display-only updates, user drilldown, debug sessions,
independent grid/chart requests, cancellation and refresh cleanup.

Run `npm run check` for strict types, formatting, production compilation and the complete suite.
Company database responses and live browser layout still require validation in the target runtime.
