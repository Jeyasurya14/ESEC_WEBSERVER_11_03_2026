# License bottom toolbar

Report component internals and shared loading/rendering are described in
[bottom-report-components.md](bottom-report-components.md).

## Company source analysis

Source project: `D:\ESEC_WEBSERVER_CODE_GEN_5_AUG_2025`.
The relevant bottom `toolBarContent` is inside `selectReportCls` in these four screens:

- `src/app/ev3-components/ev3-license/ev3-lic-organization/ev3-lic-organization.component.{html,ts}`
- `src/app/ev3-components/ev3-license/ev3-lic-division/ev3-lic-division.component.{html,ts}`
- `src/app/ev3-components/ev3-license/ev3-lic-department/ev3-lic-department.component.{html,ts}`
- `src/app/ev3-components/ev3-license/ev3-lic-group/ev3-lic-group.component.{html,ts}`

The similarly named top toolbars hold filters and view controls. The bottom section is a
report selector, with a separate catalog and selected menu id in each screen.

### Behavior

1. `treeData` defines the available reports and their display order. Summary is initially selected.
2. `selectNode` changes the selected report. It does not open the previously selected software.
3. Clicking a Software link calls `treeViewMenuClick`, which captures software, server, license,
   feature, issued quantities, location and the selected scope identity.
4. `gblFunctions.updatePeriods()` supplies dates/times from preferences or stored report dates.
5. A report-specific `load...` method sets report arguments and imports its module.
   `addReportInTab` opens the result in a new workspace tab.
6. Bundle is the exception: its bottom button calls `loadBundle` immediately. Its data comes
   from all loaded rows (`dbResult`), and it is disabled when that list is empty.
7. Previous/next controls scroll horizontally. Each screen repeats resize and edge-state code
   through `getToolBarStatus`, `gbl_summary_previousClick` and `gbl_summary_nextClick`.

The source repeats `id_selParentMenu` across entries and uses clickable divs with visual disabled
classes. The new implementation uses native buttons, actual disabled states and toolbar semantics.

### Complete action mapping

There are 57 menu entries across the four screens: 21 Organization, 12 Division, 11 Department
and 13 Group. Configured Division/Department labels are preserved.

| Action                | Company dispatch                               | Availability                       | New destination                                     |
| --------------------- | ---------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| Summary               | `loadSummary`                                  | All four                           | `LicenseSummary`                                    |
| Utilization           | `loadUtilzDate`; Group `loadDateTimeRange`     | All four                           | `LicenseDetail` / `GroupDetails`                    |
| History               | `loadHistory`                                  | Organization                       | `LicenseDetail`                                     |
| QOS                   | `loadQOS`                                      | Organization                       | `LicenseDetail`                                     |
| Heatmap               | `loadHeatmap`                                  | All four                           | `LicenseDetail` / `GroupDetails`                    |
| Month                 | `loadMonth`                                    | Organization                       | `LicenseDetail`                                     |
| Date                  | `loadDate`                                     | Organization, Group                | `LicenseDetail` / `GroupDetails`                    |
| Member                | `loadMember`                                   | Group                              | `GroupDetails`                                      |
| Hours                 | `loadHoursUsedDays`                            | All four                           | `LicenseDetail` / `GroupDetails`                    |
| Usage                 | `loadUsage`                                    | All four                           | `LicenseDetail` / `GroupDetails`                    |
| Utilization and Hours | `loadUtilzHourDay`                             | All four                           | `LicenseDetail` / `GroupDetails`                    |
| Checkout User         | `loadCheckoutList`                             | All four                           | `LicenseDetail`, checkout mode / `GroupDetails`     |
| Checkout Count        | `loadCheckoutDate`                             | All four                           | `LicenseDetail` / `GroupDetails`                    |
| Long Duration         | Duration branch in `treeViewMenuClick`         | All four                           | `LicenseDetail`, longDuration mode / `GroupDetails` |
| Denial                | `loadDenial`                                   | All four                           | `LicenseDetail` / `GroupDetails`                    |
| Borrow                | `loadBorrow`; Group `loadDistinct`             | All four                           | `LicenseDetail` / `GroupDetails`                    |
| Division              | `loadShowDivision`                             | Organization                       | `Division`                                          |
| Department            | `loadShowDepartment`                           | Organization, Division             | `Department` / `GroupDetails`                       |
| Reservation           | `loadShowGroup`                                | Organization                       | `Group`                                             |
| Asset Info            | `loadAssetInfo`                                | Organization                       | `LicenseDetail`                                     |
| Debug Data            | `loadDebugData`                                | Organization                       | `LicenseDetail`                                     |
| Bundle                | `selectNode` → `loadBundle` → `loadBundleData` | Organization, loaded rows required | `LicenseBundle`                                     |

Organization order matches the table with Member omitted. Division and Department omit the
Organization-only actions. Division ends with Department. Group puts Date and Member immediately
after Heatmap and before Hours; it omits History, QOS and Month.

Scope identity stays in the selected row: Division uses `divn`; Department uses `divn` and `dept`;
Group uses `g_type`, `g_name` and reservation quantities. The toolbar never reconstructs these
values from a display label.

## New implementation

| File                                                                 | Responsibility                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/app/shared/report-action-bar/report-action-bar.{ts,html,scss}`  | Reusable visual toolbar, scrolling, keyboard focus, selected and disabled states |
| `src/app/reports/license/drilldown/license-actions.ts`               | Typed action ids, scope order, configured labels and Bundle availability         |
| `src/app/reports/license/drilldown/license-drilldown-loader.ts`      | Lazy destinations with consistent report context inputs                          |
| `src/app/reports/license/drilldown/license-drilldown.{ts,html,scss}` | Arm/open behavior, workspace tabs, loading, retry and stale-load guards          |
| `src/app/reports/license/drilldown/drilldown-range.ts`               | Date boundaries resolved when opening a report                                   |

All four screens use the shared Organization template and coordinator. Report settings travel as
one object; thresholds and heatmap colors are derived from it rather than duplicated inputs.
The visual toolbar has no API, database or workspace dependency and can be reused independently:

```html
<app-report-action-bar
  label="Report views"
  [actions]="actions()"
  [activeId]="selectedView()"
  [busy]="opening()"
  (actionSelected)="chooseView($event)"
/>
```

`actions` is a readonly list of `{ id, label, disabled? }`. Selection emits the typed id; the owner
decides whether to arm a report or open it immediately. Each toolbar instance owns its focus and
scroll position. No document-wide selectors or repeated DOM ids are used.

### UI and accessibility

- Compact single row with an explicit selected state and no instruction paragraph below it.
- Native horizontal scrolling works with touch/trackpad; labelled arrow controls appear on overflow.
- Resize observation measures both the available width and changing content. Arrows disable at
  either end and their own width does not cause visibility oscillation.
- One report button participates in Tab navigation. Left/Right wrap through enabled buttons;
  Home/End focus the first/last enabled action. Enter/Space use native button activation.
- Moving focus does not select or open a report. The selected action uses `aria-pressed` in a
  labelled toolbar, rather than claiming an inline tab panel exists.
- Visible focus styling and reduced-motion support are included. Resize observers disconnect
  when their view is destroyed.

### Opening and data context

- Relative dates resolve on each open, so a long-lived workspace does not cache yesterday's date.
- Date-based reports receive the current parent range: 7/30/60/90/180/360 days, YTD, month,
  quarter or year. Dates use local calendar boundaries and existing SQL-safe serialization.
- Division, Department and Reservation reuse the full scoped grid/gauge screen and inherit the
  parent period before their first request. Their day/month/quarter/year procedure variants are
  documented in [license-detail-migration.md](license-detail-migration.md).
- Every click on a gauge generates a new selection, including repeated clicks on the same gauge.
- Only the chosen destination is lazy loaded; Checkout User and Long Duration share their component.
- Both the catalog/coordinator and loader reject unavailable scope/action combinations.
- Bundle receives a snapshot of the loaded row list and cannot open an empty list.
- New row selection or changing the armed action invalidates an earlier pending open. Destroying
  the originating view prevents its late load from opening a tab. Load failures show Retry.
- Opened workspace tabs remain independent; subsequent toolbar selections do not rewrite them.

Summary now opens the migrated four-chart dashboard and Indicators grid. Its source contracts and
controls are documented in [license-summary.md](license-summary.md). Other destinations retain
their existing stored procedures.

## Verification

`npm run check` runs strict TypeScript checks, formatting, the production build and the test suite.
Focused tests cover all 57 destinations, valid Angular component input names, exact scope order,
configured labels, Bundle guards, checkout modes, period boundaries including leap years,
keyboard navigation, overflow edges, resize cleanup, repeat gauge selection, failed imports,
retry, reversed load completion, action changes and destroyed views.

Tests use controlled data and measured DOM dimensions. Live browser layout and company database
responses still require a check in the target runtime.
