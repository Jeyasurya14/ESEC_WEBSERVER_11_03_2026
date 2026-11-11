# ESEC (Angular 21)

Start-up licence check, sign-in, and a menu that depends on who signed in.

```bash
npm start      # dev server
npm test       # unit tests
npm run build
```

## The flow

There is no URL routing. `AppComponent` shows one screen, chosen from the state in `LoginService`:

| Licence checked? | Signed in? | Screen             |
| ---------------- | ---------- | ------------------ |
| no               | -          | `OnstartComponent` |
| yes              | no         | `LoginComponent`   |
| yes              | yes        | `HomeComponent`    |

## Folder layout

```
src/app/
  app.component.*        Picks the screen to show (startup, login or home)
  core/                  App-wide logic with no screens
    models.ts              Shared types
    api/                   All HTTP, plus the app settings
    auth/                  Sign-in steps and the signed-in session (LoginService)
    license/               Licence rules (pure functions)
    menu/                  Menu rules and loading a user's menu
    preferences/           The user's saved choices (shared with the company app's preference table)
    storage/               Everything kept in localStorage, under the company app's key names
  features/              The screens the user moves through
    onstart/               Licence and maintenance check before login
    login/                 Sign-in form
    home/                  Header, sidebar and the work area
    tabs/                  Open report tabs
  shared/                Building blocks every report uses
    filters/               One file per filter: its component and its rules (range, option, bands, ...)
    grid/                  The report grid (AG Grid) and column helpers
    dates.ts               Reading and showing dates ("15-Mar-2026")
    report-settings.service.ts  Band limits, working hours and defaults, loaded once
    report-data.ts         Loading a report's rows: newest reply wins, loading/error/"As on"
  reports/               One folder per report screen, grouped by menu
    reports.ts             The list of which component each menu screen opens
    license/organization/  Example report with filters and a grid
```

`core/` never imports from `features/`, `shared/` or `reports/`; `shared/` never imports from `reports/`.

## Adding a report (one per menu screen)

Reports live in `src/app/reports/<menu>/<report>/`, for example `reports/license/organization/`.

1. Generate it, for example for License / Department: `ng generate component reports/license/department`
2. Copy `organization.ts`: it has an `input.required<UserMenu>()` called `menu` and `host: { class: 'report-page' }`.
3. Add one line to the list in `reports/reports.ts`:

```ts
['LICENSE/Department', () => import('./license/department/department').then((m) => m.Department)],
```

The key is `MENU/Screen`, exactly as in the menu. A screen that isn't listed opens a placeholder, so reports
can be migrated one at a time. The tests open every listed report, so a wrong path or a missing `menu`
input fails there.

## A report with filters and a grid

`reports/license/organization/` is the pattern to copy. A report has three files:

- **`<report>.data.ts`**: the row type, the stored-procedure call, and the report's rules as plain
  functions (preparing rows, which rows a filter keeps, the column list). These are tested directly.
- **`<report>.ts`**: `providers: [ReportFilters, ReportData]`. `ReportFilters` gives every shared filter,
  started from the user's saved choices and saved again on each change. `ReportData` loads the rows
  (`data.load(sql, prepare)`), keeps only the newest reply, and tracks loading, errors and "As on".
  Add a `rows` computed from the loaded rows and the filters. Filters the server applies (Range,
  Feature group) trigger a reload; the others narrow the loaded rows instantly.
- **`<report>.html`**: the filters in a `report-toolbar`, then `<app-data-grid>`.

```html
<div class="report-toolbar">
  <app-search-filter [(text)]="filters.search" />
  <app-range-filter [(range)]="filters.range" />
</div>
<app-data-grid [rows]="rows()" [columns]="columns()" [search]="filters.search()" [loading]="loading()" />
```

Saved choices use the company app's preference table and keys (`a_user_pref_load` / `a_user_pref_insert`:
`range_main`, `option`, `my_feature`, `lmh_check`, `act_inact`, `not_expired`), so both apps share them.

Columns use the helpers in `shared/grid/columns.ts`, so a column is one line:
`numberColumn('qty_dp', 'Quantity', { hide: true })`. A new filter goes in `shared/filters/` as one file
holding its component and its rule, so every report can use it.
