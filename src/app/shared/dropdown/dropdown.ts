import { optionGroups } from './dropdown.utils';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export interface DropdownOption {
  value: string;
  label: string;
  group?: string;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

let nextDropdownId = 0;

@Component({
  selector: 'app-dropdown',
  template: `
    <button
      type="button"
      class="dropdown-trigger"
      [attr.aria-label]="triggerName()"
      [attr.aria-expanded]="isOpen()"
      [attr.aria-controls]="isOpen() ? listId : null"
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

    @if (isOpen()) {
      <ul
        class="dropdown-menu"
        role="listbox"
        [id]="listId"
        [attr.aria-label]="ariaLabel() || selectedLabel()"
        [style.top.px]="menuPosition()?.top"
        [style.left.px]="menuPosition()?.left"
        [style.min-width.px]="menuPosition()?.width"
      >
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
  host: {
    class: 'dropdown',
    '(document:click)': 'closeOnOutsideClick($event)',
    '(document:keydown.escape)': 'closeOnEscape()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dropdown {
  readonly options = input.required<DropdownOption[]>();
  readonly value = input.required<string>();
  readonly ariaLabel = input<string>();
  readonly valueChange = output<string>();

  private readonly element = inject(ElementRef<HTMLElement>);
  protected readonly listId = `dropdown-${++nextDropdownId}`;

  protected readonly isOpen = signal(false);
  protected readonly activeValue = signal<string | null>(null);

  protected readonly menuPosition = signal<MenuPosition | null>(null);

  protected readonly selectedLabel = computed(
    () =>
      this.options().find((option) => option.value === this.value())?.label || 'Select an option',
  );

  // Keep the spoken name in sync with the visible selection; append its field context.
  protected readonly triggerName = computed(() => {
    const selection = this.selectedLabel();
    const context = this.ariaLabel()?.trim();
    return context && context.toLowerCase() !== selection.toLowerCase()
      ? `${selection}, ${context}`
      : selection;
  });

  protected readonly groups = computed(() => optionGroups(this.options()));

  protected readonly activeOptionId = computed(() => {
    const activeOptionValue = this.activeValue();
    return this.isOpen() && activeOptionValue !== null ? this.optionId(activeOptionValue) : null;
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.isOpen()) {
        return;
      }
      const closeDropdown = () => this.isOpen.set(false);
      document.addEventListener('scroll', closeDropdown, { capture: true, passive: true });
      onCleanup(() => document.removeEventListener('scroll', closeDropdown, { capture: true }));
    });
  }

  protected optionId(optionValue: string): string {
    return `${this.listId}-${optionValue}`;
  }

  protected toggle(): void {
    const opening = !this.isOpen();
    this.isOpen.set(opening);
    if (opening) {
      this.activeValue.set(this.value());
      const triggerBounds = this.element.nativeElement.getBoundingClientRect();
      this.menuPosition.set({
        top: triggerBounds.bottom + 4,
        left: triggerBounds.left,
        width: triggerBounds.width,
      });
    }
  }

  protected choose(selectedOptionValue: string): void {
    this.isOpen.set(false);
    if (selectedOptionValue !== this.value()) {
      this.valueChange.emit(selectedOptionValue);
    }
  }

  protected onArrowDown(event: Event): void {
    event.preventDefault();
    if (this.isOpen()) {
      this.moveActive(1);
    } else {
      this.toggle();
    }
  }

  protected onArrowUp(event: Event): void {
    event.preventDefault();
    if (this.isOpen()) {
      this.moveActive(-1);
    }
  }

  protected onEnter(): void {
    const activeOptionValue = this.activeValue();
    if (this.isOpen() && activeOptionValue !== null) {
      this.choose(activeOptionValue);
    }
  }

  private moveActive(step: 1 | -1): void {
    const allOptions = this.options();
    if (allOptions.length === 0) {
      return;
    }
    const currentIndex = allOptions.findIndex((option) => option.value === this.activeValue());
    const nextIndex = Math.min(Math.max(currentIndex + step, 0), allOptions.length - 1);
    this.activeValue.set(allOptions[nextIndex].value);
  }

  protected closeOnOutsideClick(event: MouseEvent): void {
    if (
      this.isOpen() &&
      (!(event.target instanceof Node) || !this.element.nativeElement.contains(event.target))
    ) {
      this.isOpen.set(false);
    }
  }

  protected closeOnEscape(): void {
    this.isOpen.set(false);
  }
}
