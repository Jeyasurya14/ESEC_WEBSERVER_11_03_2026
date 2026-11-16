# Angular architecture

The application uses Angular 21 standalone components, signal bindings, OnPush change detection and explicit zoneless bootstrap. TypeScript strict mode and Angular strict template checking remain enabled.

## Reads and writes

`shared/report-data.ts` owns report reads through `resource()`. Changing a query cancels the previous HTTP request. Destroying the report cancels its resources. Loading, ready, empty and error states form a discriminated union; successful refresh timestamps are recorded only after a successful response and transformation.

`core/api/api-request.ts` contains the HTTP interop boundary. Angular HttpClient still returns Observables so existing API contracts remain intact. `apiRequest()` converts one response into a Promise and connects its subscription to an abort signal. Its `using` scope removes listeners and releases the request on completion, cancellation or failure.

`resourceRequest()` supports existing Promise-based service methods and shared cached reads. It creates a short-lived resource, then disposes its effect, resource and destroy callback with `using`. Feature-group selections and weekly holiday reads use resources directly so changing their parameters also cancels obsolete requests.

Writes and authentication commands use `apiRequest()` directly. Preference saves remain ordered within each user session; replacing that queue with cancellable resources could interrupt a write. Shared feature-group caching keeps only the current user's entry and clears on service destruction. Parsed heatmap data uses a WeakMap keyed by immutable response arrays so discarded reports can be collected.

Angular 21 marks [`resource()` as experimental](https://v21.angular.dev/guide/signals/resource). Re-run the checks when updating Angular. TypeScript transpiles `using`; the project includes disposable type definitions and a `Symbol.dispose` fallback. Promise completion uses `Promise.withResolvers()`.

## Types and transformations

`core/utils/data.ts` supplies record validation, safe object-key narrowing and exhaustive state checks. Configuration objects use contextual types or `satisfies`; const-generic `literal()` preserves literal values without type assertions. Shared shapes use `Pick`, `Omit`, `Partial` and `Record` where they express the same contract. Template handlers use `shared/input-value.ts` to read native control values and validate select options instead of bypassing checking with `$any()`.

Component calculations remain memoized with `computed()`. Reusable transformations live alongside the UI:

| Utility                                                  | Responsibility                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `shared/charts/heatmap-chart.utils.ts`                   | Index points by date row, calculate the viewport and preserve full-data exports |
| `shared/dropdown/dropdown.utils.ts`                      | Group options in one pass                                                       |
| `reports/license/license-chart.utils.ts`                 | Find numeric metrics, choose defaults and assemble chart series                 |
| `reports/license/detail/license-detail.utils.ts`         | Filter rows, calculate hours and aggregate usage                                |
| `reports/license/custom-report/custom-report.utils.ts`   | Build filter options, search features and validate saved selections             |
| `reports/license/feature-groups/feature-groups.utils.ts` | Validate saved group rows and apply selected feature keys                       |

Percentile quantity joins, bundle indexes, removed-feature checks, settings and sidebar shortcuts use Maps or Sets instead of repeated collection scans. Backend field names, SQL procedure names, stored preference keys and external component imports remain compatible.

## Checks

Run `npm run check:architecture` to scan all TypeScript source, templates and test fixtures. It rejects explicit `any`, type assertions, template `$any()` escapes, legacy input/output/query decorators, components without OnPush, manual application subscriptions and repeated collection lookups inside iteration. It supplements the compiler and tests; it is not a substitute for performance profiling.

Run `npm run typecheck`, `npm run format:check`, `npm run build` and `npm run test:ci` for validation, or `npm run check` for the combined checks. Tests use one worker to bound memory consumption when rendering real AG Grid and Highcharts instances.

Test fixtures provide complete domain data and real disposable grid/chart objects rather than asserting that partial objects satisfy vendor contracts. Tests with deliberately pending resources start rendering without waiting for application stability, then verify that context changes and destruction release those requests. Server integration tests use mocked responses; production data is not changed by these checks.
