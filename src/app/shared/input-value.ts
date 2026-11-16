export function inputValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
    ? target.value
    : '';
}

export function isOption<T extends string>(options: readonly T[], value: string): value is T {
  return options.some((option) => option === value);
}
