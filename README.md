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

## Where to look

| File | What it does |
| ---- | ------------ |
| `services/api.service.ts` | All HTTP, plus the app settings |
| `services/license.ts` | Licence rules: `evaluateLicense(value, today)` (pure) |
| `services/menu.ts` | Menu rules: `resolvePermittedMenus(...)` and the admin menu (pure) |
| `services/login.service.ts` | Sign-in steps and the signed-in session |
| `models.ts` | Shared types |
