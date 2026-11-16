# Bottom report components and reuse

The current implementation is described report by report in
[license-detail-migration.md](license-detail-migration.md), with Summary documented separately in
[license-summary.md](license-summary.md). Navigation behavior is covered by
[bottom-toolbar.md](bottom-toolbar.md).
The shared application footer and heatmap rendering limits are covered in
[status-bar.md](status-bar.md).

## Component ownership

The toolbar captures a selected row and opens a lazy destination in its own workspace tab.
The navigation registry opens `LicenseDetail` directly with a view id, selected row, range and settings. That shared workspace owns filters, primary and
secondary requests, validation, charts, grid columns, local analysis and nested row selection.
Queries and calculations are split into pure files under `src/app/reports/license/detail`.

| Shared piece                                       | Use                                                                                                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `LicenseDetail`                                    | Utilization, History, QOS, Heatmap, Month, Date, Hours, Usage, Utilization/Hours, Checkout, Duration, Denial, Borrow, Asset Info and Debug Data |
| `Organization` with `parentRow` and `initialRange` | Complete Divn/Dept/Reservation breakdown screens and scoped bottom drilldowns                                                                   |
| `LicenseSummary` / `LicenseSummaryChart`           | Four utilization horizons, Indicators and one aggregate refresh handle                                                                          |
| `bundleMatrix` / `LicenseBundle`                   | Client-side bundle comparison, common/uncommon modules, sums and server counts                                                                  |
| `ReportData`                                       | Request cancellation, errors, successful timestamps and destruction cleanup                                                                     |
| `ReportChart`                                      | Loading/error/empty/chart presentation and Retry                                                                                                |
| `DataGrid`                                         | Shared grid rendering, filtering, sorting, exports and optional pinned rows                                                                     |
| `registerReportRefresh`                            | One lifecycle-aware workspace refresh handle per report                                                                                         |

## Adding another detail report

1. Define its typed view, capabilities and exact procedure variants in `detail-queries.ts`.
2. Keep report-specific calculations in the analytics/chart files and columns in the column file.
3. Add its view id to the detail report map in `drilldown/license-drilldown-loader.ts`.
4. Add its action to the scope catalog in `drilldown/license-actions.ts`.
5. Verify query arguments, local controls, row drilldowns, refresh and request cancellation.

Each tab owns its data and selection. Display-only changes reuse loaded responses. SQL changes
cancel replaced requests. A report with separate grid/chart procedures owns separate data sources
and exposes one aggregate refresh handle. Backend fields beyond the named base schema are kept as
additional columns instead of being discarded.

Run `npm run check` for types, formatting, production compilation and the complete suite. Live
company API responses and browser layout still need validation in the target runtime.

## Highcharts rendering and cleanup

Heatmaps in Organization and scoped reports use `shared/charts/heatmap-options.ts`. The builder owns date/hour axes, metric selection, percentage colors, range/zero visibility and Issued/Used labels. Hidden cells keep their axis positions; malformed dates, hours and non-finite values are excluded. Gauges use the shared `Gauge` component and `gaugeChartOptions`, with safe values and a labeled readout. All chart surfaces are white.

`provideHighchartsCharts` loads the official gauge, heatmap, accessibility and export modules once. The inactive AG Charts grid integration and its direct dependency were removed. AG Grid remains the table renderer. Unreachable legacy chart builders, obsolete report-query/analysis copies and the unused ReportGrid wrapper were removed with their redundant tests; active query, analytics and component tests remain.

## Folder structure

| Folder            | Contents                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `organization/`   | Main report only: component, template, styles, data rules and component/data tests in one spec (5 files) |
| `drilldown/`      | Shared toolbar coordinator, action catalog, lazy destination registry, reporting ranges and their tests  |
| `detail/`         | Shared detail workspace, queries, charts, columns and usage calculations                                 |
| `detail/columns/` | Three focused column factories: usage, user sessions and assets                                          |
| `summary/`        | Summary charts, indicators and their loader                                                              |
| `group-details/`  | Division, Department and Group detail reports                                                            |
| `bundle/`         | Bundle comparison screen and matrix calculations                                                         |

To follow a report, start at `drilldown/license-actions.ts`, find its destination in `drilldown/license-drilldown-loader.ts`, then open `detail/license-detail.ts`. All procedure variants are in `detail/detail-queries.ts`; there are no parallel per-report query helpers. The existing Division, Department and Group components serve parent-row breakdowns directly.

The former Organization drilldown directory contained 49 files. Its shared navigation and Bundle implementation were moved to their owning folders, and 37 superseded adapter/query/test files were replaced by shared destinations and focused column factories. Tests cover the active workspace, rather than retired wrappers.

## Gauge visibility and company heatmap layout

Gauge tiles initialize their Highcharts dial when they enter the viewport, including when a hidden workspace tab becomes visible. Each dial has an explicit 168px chart height and a pane that fits inside it. Tile-level `content-visibility` was removed so chart measurements do not depend on skipped browser layout. Offscreen tiles defer Highcharts creation through IntersectionObserver.

Heatmaps retain Highcharts and now use the company matrix presentation: 24 hour columns with a dark header, chronological date rows, 23px percentage rows or 40px Used/Issued rows, cell borders, percentages always visible, two-line quantity/percentage labels and pink holiday dates. `holi_date` is recognized by working-day filtering. `HeatmapControls` provides Peak/Average radio buttons, Used/Issued checkboxes, seven configurable color-band buttons and date sorting for both Organization and scoped reports. Color-band and display controls reuse loaded data. The matrix scrolls instead of shrinking a month of cells into a small chart.

## Bounded gauge rendering and isolated matrix headers

Gauge reports use the reusable `shared/gauge/gauge-grid.ts` scrolling grid. A full-height spacer preserves access to every filtered record while only the visible rows and one buffer row on each side are mounted. Columns adapt to the viewport width; fixed-height cards keep scrolling positions predictable. Filtering resets the scroll position to the top. There are no page controls. Dials are created when visible and destroyed again when scrolled away or when their workspace tab is hidden; the observer stays attached until component destruction. Resize observers and pending scroll frames are released on destruction. Number formatting reuses one Intl formatter instead of constructing it for every statistic. The large-report regression scrolls through 3,000 records, reaches the final gauge and checks that the mounted card count stays bounded.

`shared/charts/heatmap-chart.ts` owns one isolated scroll region containing a native sticky Date/hour header and the Highcharts cells. Highcharts floating scroll overlays and the custom SVG header were removed from the live matrix. Header and body share the same column widths, while filters remain outside the scroll region. Image exports restore hour-axis labels in the exported chart.
