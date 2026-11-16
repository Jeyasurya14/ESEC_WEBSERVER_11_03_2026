export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasKey<T extends object>(value: T, key: PropertyKey): key is keyof T {
  return Object.hasOwn(value, key);
}

export function fieldValue(value: unknown, field: string): unknown {
  return isRecord(value) ? value[field] : undefined;
}

export function literal<const T>(value: T): T {
  return value;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled state: ${String(value)}`);
}

export function namedValues<T>(rows: readonly { _DESC: string; _VALUE: T }[]): Map<string, T> {
  const values = new Map<string, T>();
  for (const row of rows) if (!values.has(row._DESC)) values.set(row._DESC, row._VALUE);
  return values;
}
