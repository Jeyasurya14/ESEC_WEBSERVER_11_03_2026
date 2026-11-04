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
  features/              The screens the user moves through
    onstart/               Licence and maintenance check before login
    login/                 Sign-in form
    home/                  Header, sidebar and the work area
    tabs/                  Open report tabs
  reports/               One folder per report screen, grouped by menu
    reports.ts             The list of which component each menu screen opens
    license/organization/  Example report
```

`core/` never imports from `features/` or `reports/`.

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
