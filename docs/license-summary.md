# License Summary: company analysis and implementation

## Source inspected

Company project: `D:\ESEC_WEBSERVER_CODE_GEN_5_AUG_2025`.

- `src/app/ev3-components/ag-templates/ag-summary-template/ag-summary-template.component.ts`
- The accompanying HTML, CSS, module and custom header.
- Organization, Division, Department and Group `loadSummary` methods and selected-row arguments.
- The series colors and working-hour settings in `src/app/gblfunction.ts`.

The company Summary is a dashboard. A Summary selection captures a software/server/license row,
scope identity and its display label, then opens `AgSummaryTemplateComponent` in a new workspace
tab. That component builds four charts and an Indicators grid. The current implementation now
opens `LicenseSummary` in that same bottom-toolbar flow.

## Data contracts

Five separate queries use the selected scope identity. They do not take the main report's selected
date range: the stored procedures provide fixed historical horizons and indicator presets.

| Scope        | Procedure prefix         | Arguments, in order                     |
| ------------ | ------------------------ | --------------------------------------- |
| Organization | `esms_m.r_organization_` | server, license                         |
| Division     | `esms_m.r_division_`     | server, license, division               |
| Department   | `esms_m.r_department_`   | server, license, division, department   |
| Group        | `esms_m.r_group_`        | server, license, group type, group name |

| Section    | Suffix        | Source title          | Presentation                                       |
| ---------- | ------------- | --------------------- | -------------------------------------------------- |
| Day        | `chart_30`    | 30 Days Utilization   | Line chart                                         |
| Week       | `chart_week`  | 52 Weeks Utilization  | Line chart                                         |
| Month      | `chart_month` | 12 Months Utilization | Columns with an Issued line in Value mode          |
| Year       | `chart_year`  | 10 Years Utilization  | Columns with an Issued line in Value mode          |
| Indicators | `indicator`   | Indicators            | Metrics as rows; seven returned periods as columns |

For example, Department Summary calls
`esms_m.r_department_chart_30(server, license, division, department)` and uses the same identity
arguments for its other four procedures. All string arguments use the existing SQL literal escaping.

The company template also contains a `MULTI_ORGS` branch using `esms_x` procedures and an additional
leading site argument. This License migration connects the four scopes already present in the
current project's License screens. A Multi Site integration requires that module's site context.

## Chart behavior

The X-axis uses returned `date` labels in response order. Quantities and percentages are read from
the separate fields supplied by the procedures; percentages are not recalculated from chart quantities.

| Series         | Value field | Percentage field | Company color | Available horizons   |
| -------------- | ----------- | ---------------- | ------------- | -------------------- |
| Day Peak       | `qty_dp`    | `p_dp`           | `#1414E1`     | All four             |
| Day Avg        | `qty_da`    | `p_da`           | `#5C8001`     | All four             |
| Day Peak Mean  | `qty_dpm`   | `p_dpm`          | `#FF006E`     | Week, Month, Year    |
| Day Avg Mean   | `qty_dam`   | `p_dam`          | `#649df8`     | Week, Month, Year    |
| Work Peak      | `qty_wp`    | `p_wp`           | `#ff4500`     | All four             |
| Work Avg       | `qty_wa`    | `p_wa`           | `#FBB02D`     | All four             |
| Work Peak Mean | `qty_wpm`   | `p_wpm`          | `#7A4419`     | Week, Month, Year    |
| Work Avg Mean  | `qty_wam`   | `p_wam`          | `#7CB518`     | Week, Month, Year    |
| Issued         | `qty_i`     | —                | `#8E44AD`     | All four, Value mode |

Initial mode is Value. Day Peak, Work Peak and Issued start visible. Global toggles control the
same series across all applicable panels. Switching mode resets that selection to the defaults
and clears the daily Working Days filter. Percentage mode hides the Issued control and series.

Only the daily chart has Working Days filtering. It retains records with `holi = n`; holiday
records (`holi = y`) otherwise have red axis labels. Labels and overlap are controlled per panel.
Labels suppress repeated adjacent values, as the company template does.

The company code supports zoom/pan, labels, overlap, fullscreen and maximize/restore controls.
The new panels provide labels, overlap and Expand/Restore controls directly. The chart menu supplies
fullscreen, printing, PNG/JPEG/SVG downloads and CSV/XLS data downloads. Exporting is local and
server fallback is disabled. Data-export initialization waits for the Exporting module.

Missing or non-finite numeric values become chart gaps. Percentage axes use a soft upper limit of
100 so values above 100 remain visible; the old fixed 110% upper bound could clip those values.
Dynamic axis labels are escaped before adding holiday markup.

## Indicators

The indicator procedure returns records identified by `type`. The source's `transform` method
pivots them into rows with columns `ytd`, `07`, `30`, `60`, `90`, `180`, `360`. The new pure
`summaryIndicators` function performs that pivot without changing the API records. It accepts
`YTD`/`ytd` and normalizes `7` to `07`.

The rows are Issued, Reserved, Borrow, all eight usage metrics, Users, Denial Users, True Denial,
License Hours Used, License Hours Available, and License Hours %. Organization and Group show
all 17 metrics. Division and Department omit Reserved and the two capacity metrics, matching
the source's scope conditions.

The source rescales available hours using configured working hours before calculating usage:

```text
available hours = returned tlh_24 × working hours per day ÷ 24
license hours % = returned tot_du_q ÷ available hours × 100
```

Available hours display at up to four decimals. The percentage is rounded to one decimal. Zero
available hours yields 0%. Missing fields/periods stay blank. For example, `tlh_24 = 48`, working
hours = 7 and `tot_du_q = 7` produce 14 available hours and 50% utilization. `avg_du` supplies the
separate License Hours Used row, as in the company template.

Description stays pinned on the left. Percentage cells reuse the shared usage-band renderer and
configured thresholds/colors. Existing DataGrid sorting, filters, column tools and exports remain
available. Indicators can expand independently of the charts.

## Component and request ownership

| File                                 | Responsibility                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `license-grouped-report-registry.ts` | Typed periods/series, scope SQL contracts, indicator pivot and grid columns                         |
| `summary-chart-options.ts`           | Pure chart construction, numeric handling, daily filtering and label escaping                       |
| `summary-loader.ts`                  | Five independent ReportData instances and aggregate refresh state, provided per tab                 |
| `license-summary-chart.ts`           | Reusable panel for each horizon, local display controls and shared ReportChart rendering            |
| `license-summary.{ts,html,scss}`     | Scope inputs, shared series/mode controls, dashboard layout, expansion, retry and workspace refresh |

The old component initializes requests with nested timeouts and maintains separate mutable chart
objects and series indices. The current dashboard starts the five requests concurrently and uses
signals/computed chart options. Each panel has its own loading/error/empty state. A failed panel
can retry its own query while the other panels remain usable.

One workspace refresh handle reloads all five datasets and preserves display choices. Its loading
state covers all requests. Its timestamp appears only when all datasets have succeeded and uses
the oldest successful dataset time, so retrying one panel does not claim the other panels are new.
Changing the selected row cancels replaced requests. Closing the Summary tab cancels all pending
requests and unregisters its refresh handle.

The dashboard follows its workspace container's width, adapting from four charts beside Indicators
to stacked panels as the sidebar reduces available space. Expansion hides sibling panels without
destroying their data sources. Radio groups
have instance-specific names, so two open Summary tabs do not alter each other's controls.

## Verification

Tests cover all four scope query contracts, scope argument order/escaping, all indicator periods,
working-hour scaling, zero/missing values, scope-specific metrics, every chart series mapping,
holiday filtering/escaping, chart types, local export options, initial selection, display-only
updates, expansion, partial failures, panel retry, aggregate refresh, cancellation and tab isolation.
The existing toolbar loader tests now verify `LicenseSummary` and its inputs in all four scopes.

Run `npm run check` for strict types, formatting, the production build and the complete test suite.
Tests use controlled API responses; live company database results and browser layout still need
validation in the target runtime.
