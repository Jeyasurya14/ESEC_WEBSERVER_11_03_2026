# Shared application status bar

The company implementation is in `ev3-default-layout` and
`ag-selectors/ag-selector-whrs-percentile`. The footer's active standard controls are the
report range, time window, Parameters popup and loading indicator. Parameters include Usage
Per Day, Percentile, Long Duration and CPU Hours Per Day. Range, time and parameters use the
`range_sub*` and `parameters_*` user preference keys. The company share routes hide controls
that do not apply, notably time and Parameters on Heatmap. The older footer report-button
loop and missing-log-file alert are commented out in the source.

## Current ownership

| File                                                | Responsibility                                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `shared/status-bar/status-bar.ts`, `.html`, `.scss` | One footer, draft editors, validation, preference saves, active-report refresh/loading/timestamp and user identity |
| `shared/status-bar/report-controls.ts`              | Typed control contract, parameter metadata, local-calendar presets and safe restoration of company preferences     |
| `shared/report-refresh.ts`                          | Registers each report's refresh handle and optional controls; removes both with the report                         |
| `features/tabs/tab.service.ts`                      | Selects the active tab's handle and removes it when the tab closes                                                 |
| `shared/filters/report-filters.ts`                  | Restores footer defaults using the already-loaded user preferences                                                 |

Reports supply getters and setters for their existing state. The footer contains no SQL or
report-specific query logic. Top and bottom controls edit the same report instance. Draft
dates/times/parameters do not run queries while typing. Apply validates and commits the whole
edit; Cancel and Escape discard it. Switching tabs closes an unfinished editor. Each tab
retains its own state, and saved footer defaults seed subsequently opened reports. Existing
settings and preference services remain responsible for request caching and merging saves.

## Connected reports

| Report                                                                    | Footer controls                                                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Organization, Division, Department, Group and their parent-row breakdowns | Shared main range and Usage Per Day                                                                                                                    |
| License detail reports                                                    | Date range; time only for supported query modes; Usage Per Day for Month/Date/Hours; Percentile for History/QOS; Long Duration for its duration report |
| Scoped detail reports                                                     | Date range except the fixed department breakdown; time for Utilization/Checkout Count; usage hours for Hours and duration for Long Duration            |
| Custom reports                                                            | Date range, Usage Per Day and Percentile when its percentile view is selected                                                                          |
| Other report types                                                        | Their registered refresh, loading state and successful timestamp                                                                                       |

Usage Per Day is decimal hours: 7.5 means 7 hours 30 minutes. Organization reloads its original
server response before recalculating available hours, avoiding repeated scaling of an already
scaled response. Date recalculates its hours locally. Percentile changes remain local to the
loaded chart data. Time defaults use the company utilization-time settings, falling back to
the configured working times; saved user times override them.

CPU parameter metadata is available for a future CPU report; no current report exposes an
unused control. The company chatbot-only Day Peak conditions, Working Days/Primary footer
flags and chat launcher depend on chatbot portal rights and services absent from this app.
They are not mounted as nonfunctional controls. Working-day and primary-feature controls
already owned by existing reports remain in those reports.

## Heatmap responsiveness

`shared/charts/heatmap-options.ts` caches normalized immutable responses by array identity and
metric. Display filters reuse parsed dates, values and holiday flags. Native matrix headers
stay in their own scroll surface. `HeatmapChart` keeps the full scrollbar but supplies only
visible date rows plus a four-row buffer to Highcharts. Scroll updates share one animation
frame, and resize observers/pending frames are cleaned up on destruction. Series animation
is disabled. Both main and scoped matrices use this renderer; scoped color-band and sorting
controls now pass their selections to the shared builder.

Image exports restore the complete matrix and hour axis. CSV/XLS exports generate the full
filtered date/hour matrix, independent of the scroll position. Tests cover a 360-day response
(8,640 cells), bounded live points, the last date, filter changes, full exports, real Highcharts
rendering, control validation, preference compatibility and tab isolation.
