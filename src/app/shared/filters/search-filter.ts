import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'app-search-filter',
  template: `
    <input
      class="search"
      type="search"
      autocomplete="off"
      [attr.aria-label]="placeholder()"
      [placeholder]="placeholder()"
      [value]="text()"
      (input)="text.set($any($event.target).value)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchFilter {
  readonly text = model.required<string>();
  readonly placeholder = input('Filter...');
}
