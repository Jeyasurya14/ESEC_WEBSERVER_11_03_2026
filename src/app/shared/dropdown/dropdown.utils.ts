import type { DropdownOption } from './dropdown';

export interface DropdownGroup {
  heading: string | null;
  options: DropdownOption[];
}

export function optionGroups(options: readonly DropdownOption[]): DropdownGroup[] {
  const groups = new Map<string | null, DropdownGroup>();
  for (const option of options) {
    const heading = option.group ?? null;
    let group = groups.get(heading);
    if (!group) {
      group = { heading, options: [] };
      groups.set(heading, group);
    }
    group.options.push(option);
  }
  return [...groups.values()];
}
