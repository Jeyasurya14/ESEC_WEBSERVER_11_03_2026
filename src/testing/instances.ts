export function instance<T>(value: unknown, constructor: abstract new (...args: never[]) => T): T {
  if (!(value instanceof constructor)) throw new Error(`Expected ${constructor.name}`);
  return value;
}
