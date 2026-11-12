import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export interface DropdownOption {
  value: string;
  label: string;
  /** Options sharing the same group show under one heading, in the order they first appear. */
  group?: string;
}

interface DropdownGroup {
  heading: string | null;
  options: DropdownOption[];
}

let nextDropdownId = 0;

/**
 * A styled replacement for `<select>`: a button that shows the chosen option and opens a
 * popup list on click. Browsers render a native `<select>`'s open list themselves, so it can't
 * be restyled to match the rest of the app - this draws the whole list itself instead.
 *
 * The real DOM focus never leaves the trigger button; the highlighted option is tracked with
 * `aria-activedescendant`, the same technique a native combobox uses, so no focus-juggling code
 * is needed when a user opens, arrows through and picks an option with the keyboard.
 */
@Component({
  selector: 'app-dropdown',
  template: `
    <button
      type="button"
      class="dropdown-trigger"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? listId : null"
      [attr.aria-activedescendant]="activeOptionId()"
      aria-haspopup="listbox"
      (click)="toggle()"
      (keydown.ArrowDown)="onArrowDown($event)"
      (keydown.ArrowUp)="onArrowUp($event)"
      (keydown.Enter)="onEnter()"
    >
      <span class="dropdown-value">{{ selectedLabel() }}</span>
      <span class="dropdown-chevron" aria-hidden="true"></span>
    </button>

    @if (open()) {
      <ul class="dropdown-menu" role="listbox" [id]="listId" [attr.aria-label]="ariaLabel()">
        @for (group of groups(); track group.heading) {
          @if (group.heading) {
            <li class="dropdown-group-label" role="presentation">{{ group.heading }}</li>
          }
          @for (option of group.options; track option.value) {
            <li
              [id]="optionId(option.value)"
              class="dropdown-option"
              role="option"
              [class.active]="option.value === activeValue()"
              [class.selected]="option.value === value()"
              [attr.aria-selected]="option.value === value()"
              (mouseenter)="activeValue.set(option.value)"
              (click)="choose(option.value)"
            >
              {{ option.label }}
            </li>
          }
        }
      </ul>
    }
  `,
  styleUrl: './dropdown.scss',
  host: { class: 'dropdown' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dropdown {
  readonly options = input.required<DropdownOption[]>();
  readonly value = input.required<string>();
  readonly ariaLabel = input<string>();
  readonly valueChange = output<string>();

  private readonly element = inject(ElementRef<HTMLElement>);
  protected readonly listId = `dropdown-${++nextDropdownId}`;

  protected readonly open = signal(false);
  protected readonly activeValue = signal<string | null>(null);

  protected readonly selectedLabel = computed(() => {
    return this.options().find((option) => option.value === this.value())?.label ?? '';
  });

  protected readonly groups = computed<DropdownGroup[]>(() => {
    const groups: DropdownGroup[] = [];
    for (const option of this.options()) {
      const heading = option.group ?? null;
      let group = groups.find((candidate) => candidate.heading === heading);
      if (!group) {
        group = { heading, options: [] };
        groups.push(group);
      }
      group.options.push(option);
    }
    return groups;
  });

  protected readonly activeOptionId = computed(() => {
    const active = this.activeValue();
    return this.open() && active !== null ? this.optionId(active) : null;
  });

  protected optionId(value: string): string {
    return `${this.listId}-${value}`;
  }

  protected toggle(): void {
    const opening = !this.open();
    this.open.set(opening);
    if (opening) {
      this.activeValue.set(this.value());
    }
  }

  protected choose(value: string): void {
    this.open.set(false);
    if (value !== this.value()) {
      this.valueChange.emit(value);
    }
  }

  protected onArrowDown(event: Event): void {
    event.preventDefault();
    if (this.open()) {
      this.moveActive(1);
    } else {
      this.toggle();
    }
  }

  protected onArrowUp(event: Event): void {
    event.preventDefault();
    if (this.open()) {
      this.moveActive(-1);
    }
  }

  protected onEnter(): void {
    const active = this.activeValue();
    if (this.open() && active !== null) {
      this.choose(active);
    }
  }

  private moveActive(step: 1 | -1): void {
    const flat = this.options();
    if (flat.length === 0) {
      return;
    }
    const currentIndex = flat.findIndex((option) => option.value === this.activeValue());
    const nextIndex = Math.min(Math.max(currentIndex + step, 0), flat.length - 1);
    this.activeValue.set(flat[nextIndex].value);
  }

  @HostListener('document:click', ['$event'])
  protected closeOnOutsideClick(event: MouseEvent): void {
    if (this.open() && !this.element.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    this.open.set(false);
  }
}
