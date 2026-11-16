# Code cleanup and reliability changes

The frontend keeps the current report screens, stored-procedure names, permission menu,
working-hour settings and workspace behavior. Changes focus on common causes of failures
and repeated code.

## Shared report code

- SQL DATE arguments consistently use `YYYY-MM-DD`. Display headings retain `DD-Mon-YYYY`.
- Calendar parsing rejects impossible days rather than silently moving into another month.
- `ReportData` centralizes request cancellation, errors and successful load timestamps.
- Report requests are unsubscribed when replaced, cleared or destroyed. Late replies are ignored.
- Refresh timestamps are recorded only after a successful response.
- Summary, Borrow, Denial and Group Member use the shared refresh-registration function.
- Removed the unused Division placeholder templates and duplicate year/month pivot helpers.
  Tests now exercise the year/month comparison implementation used by the actual screen.

## Sessions and workspace

- Preference saves capture their originating user session. A late response from an earlier user
  cannot overwrite the current user's choices.
- A failed preference load cannot write an incomplete set of defaults over stored preferences.
- Preference writes are coalesced with an shared save queue, preserving unrelated saved keys.
- Closed tabs release their cached injectors; live tabs keep their existing injectors and state.
- Closing all tabs invalidates pending report opens. Stale tab ids are ignored.
- Late login responses cannot re-establish a session after sign-out.
- Report Type 1 guards overlapping parameter loads, clears a cancelled session's busy state,
  and prevents changing the selected session while saving or deleting it.
- Feature group lists deduplicate entries, retry failed loads and avoid storing another user's
  late response in the active session.

## Numeric and chart handling

- Heatmap dates sort chronologically across months and years.
- Non-finite numbers do not enter grid/chart numeric data.
- Chart series use indexed lookups instead of repeatedly scanning the entire point list.
- Heatmap rows are mapped explicitly instead of using a double type assertion.

## Checks

```sh
npm run typecheck
npm run format:check
npm run build
npm run test:ci
# Or all of the above:
npm run check
```

TypeScript now rejects unused imports, declarations and parameters. Generated Angular artifacts
and temporary validation logs are ignored by Git.
Vitest uses at most four workers to keep AG Grid/jsdom runs within a practical memory budget.

Regression tests cover local-calendar SQL dates, invalid dates, cancelled requests, failed-load
timestamps, user changes during preference saves, late logins, pending tab opens, tab injector
cleanup, heatmap date ordering and the real year/month comparison functions.

## Production validation boundary

These checks validate frontend compilation and behavior with controlled API responses. Company
database results, backend authorization, persistence permissions and deployment configuration
still require validation in the target environment. The existing API accepts SQL strings; the
server must enforce authorization and query restrictions. Frontend menu visibility and SQL
string escaping are not substitutes for those backend controls.
