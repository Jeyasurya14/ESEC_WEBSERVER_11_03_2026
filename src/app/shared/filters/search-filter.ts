import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'app-search-filter',
  template: `
    <label class="filter search">
      <span class="app-icon" style="--icon-url: url('assets/icons/flaticon/search.svg')" aria-hidden="true"></span>
      <input
        type="search"
        autocomplete="off"
        [attr.aria-label]="placeholder()"
        [placeholder]="placeholder()"
        [value]="text()"
        (input)="text.set($any($event.target).value)"
      />
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchFilter {
  readonly text = model.required<string>();
  readonly placeholder = input('Filter...');
}
