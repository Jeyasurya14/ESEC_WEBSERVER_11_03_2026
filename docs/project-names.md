# Project names and code map

Names describe the data or action in plain English. Existing clear names stay short: `rows`,
`columns`, `filters`, `menu`, `range`, `label` and `value` are appropriate when their surrounding
component makes their purpose clear. A rename should explain the code without adding a long prefix.

## Where to find things

| Folder or file                             | Purpose                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `core/`                                    | API calls, login, license checks, permissions, preferences and browser storage |
| `features/startup/`                        | Startup connection and license-check screen                                    |
| `features/home/`                           | Header, sidebar, sidebar panel and application layout                          |
| `features/tabs/`                           | Open report tabs, tab titles and active-report state                           |
| `reports/report-registry.ts`               | Maps company menu names to lazy-loaded report components                       |
| `reports/license/organization/`            | Organization report and the shared parent for Division, Department and Group   |
| `reports/license/custom-report/`           | Feature selection, saved sessions and custom report views                      |
| `reports/license/feature-groups/`          | Create, edit and use feature groups                                            |
| `reports/license/organization-comparison/` | Compare organization usage by year or month                                    |
| `reports/license/drilldown/`               | Bottom report actions, date ranges and report loading                          |
| `reports/license/detail/`                  | Shared detail screen, queries, charts, columns and usage calculations          |
| `reports/license/group-details/`           | Detail reports for a division, department or group                             |
| `reports/license/bundle/`                  | Bundle comparison screen and matrix calculations                               |
| `reports/license/summary/`                 | Summary charts, indicators and their data loader                               |
| `reports/license/grouped-reports.ts`       | Organization/Division/Department/Group query and column helpers                |
| `shared/report-refresh.ts`                 | Connects a report to the shared footer and removes it on destruction           |
| `shared/status-bar/`                       | Bottom status bar, report controls and saved parameter defaults                |
| `shared/gauge/gauge-grid.ts`               | Gauge cards loaded while scrolling                                             |
| `shared/charts/heatmap-options.ts`         | Heatmap dates, values, colors and display options                              |
| `shared/charts/heatmap-chart.ts`           | Heatmap headers and visible-row chart rendering                                |
| `shared/grid/column-visibility.ts`         | Reads and applies saved hidden-column choices                                  |

## Main renames

| Previous name             | Current name              |
| ------------------------- | ------------------------- |
| `onstart`                 | `startup`                 |
| `report-type-one`         | `custom-report`           |
| `my-feature`              | `feature-groups`          |
| `organization-year-month` | `organization-comparison` |
| `navigation`              | `drilldown`               |
| `scoped-detail`           | `group-details`           |
| `license-result-chart`    | `license-chart`           |
| `report-query`            | `report-refresh`          |
| `my-columns`              | `column-visibility`       |
| `gauge-list`              | `gauge-grid`              |
| `usage-heatmap`           | `heatmap-options`         |
| `short-name`              | `module-label`            |

## Reading state and variables

| Name                                            | Meaning                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `reportData`                                    | The report's rows, loading state, errors and load time                 |
| `mainData` / `extraData`                        | Separate data requests used by the shared detail screen                |
| `selectedRow`                                   | The grid row selected for another report                               |
| `selectedFeatureIds`                            | Feature identifiers currently checked by the user                      |
| `selectedSessionId`                             | The saved custom-report session currently selected                     |
| `searchText`                                    | Text entered into a report's search field                              |
| `chartOptions`                                  | Highcharts configuration, including its plotted series                 |
| `visibleSeries`                                 | Chart series selected for display                                      |
| `viewMode` / `reportView`                       | The selected presentation or report type                               |
| `showChart` / `showDetails`                     | Whether a chart or detailed rows should be shown                       |
| `viewportSize` / `visibleRange`                 | Scroll-container measurements and mounted gauge rows                   |
| `draftDates` / `draftTimes` / `draftParameters` | Footer edits waiting for Apply                                         |
| `validationError`                               | Why the current edit cannot be applied                                 |
| `loadPromise` / `savePromise`                   | A pending preference load or queued preference save                    |
| `hasChanges` / `isLoaded`                       | Whether preferences need saving and whether the initial load succeeded |
| `activeTabId` / `activeReportHandle`            | The selected tab and its footer controls                               |
| `lastUpdated`                                   | A formatted timestamp displayed after a successful report load         |
| `requestId`                                     | A request sequence number used to ignore older responses               |

Component bindings, imports, lazy loaders and tests use the same names. Company menu labels,
stored-procedure names, response fields such as `sw`/`lic`/`qty_i`, preference keys and storage
keys retain their existing server contracts. Shared component inputs such as `rows`, `options`
and `loading` retain their short, familiar names.
