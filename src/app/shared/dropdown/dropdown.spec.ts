import { instance } from '../../../testing/instances';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Dropdown, DropdownOption } from './dropdown';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dropdown-host',
  imports: [Dropdown],
  template: `<app-dropdown
    ariaLabel="Fruit"
    [options]="options"
    [value]="value"
    (valueChange)="value = $event"
  />`,
})
class HostComponent {
  readonly options: DropdownOption[] = [
    { value: 'apple', label: 'Apple', group: 'Common' },
    { value: 'pear', label: 'Pear', group: 'Common' },
    { value: 'durian', label: 'Durian', group: 'Rare' },
  ];
  value = 'apple';
}

describe('Dropdown', () => {
  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const trigger = () => instance(element.querySelector('.dropdown-trigger'), HTMLButtonElement);
    const options = () => Array.from(element.querySelectorAll('.dropdown-option'));
    return { fixture, element, trigger, options };
  }

  it('shows the selected option label on the closed trigger', () => {
    const { trigger } = render();
    expect(trigger().textContent).toContain('Apple');
    expect(trigger().getAttribute('aria-label')).toBe('Apple, Fruit');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the list on click and groups options under their headings', () => {
    const { fixture, trigger, element } = render();
    trigger().click();
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    const headings = Array.from(element.querySelectorAll('.dropdown-group-label')).map(
      (node) => node.textContent,
    );
    expect(headings).toEqual(['Common', 'Rare']);
  });

  it('picks an option on click, closes the list and reports the new value', () => {
    const { fixture, trigger, options } = render();
    trigger().click();
    fixture.detectChanges();

    const pear = options().find((option) => option.textContent?.trim() === 'Pear')!;
    pear.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.value).toBe('pear');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('Pear');
    expect(trigger().getAttribute('aria-label')).toBe('Pear, Fruit');
  });

  it('uses the visible label for unnamed and empty dropdowns', () => {
    const fixture = TestBed.createComponent(Dropdown);
    fixture.componentRef.setInput('options', []);
    fixture.componentRef.setInput('value', '');
    fixture.detectChanges();
    const trigger = instance(fixture.nativeElement, HTMLElement).querySelector('button')!;
    expect(trigger.textContent?.trim()).toBe('Select an option');
    expect(trigger.getAttribute('aria-label')).toBe('Select an option');
    fixture.componentRef.setInput('options', [{ value: 'day', label: 'Day' }]);
    fixture.componentRef.setInput('value', 'day');
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-label')).toBe('Day');
  });

  it('closes on Escape without changing the value', () => {
    const { fixture, trigger, element } = render();
    trigger().click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(element.querySelector('.dropdown-menu')).toBeNull();
  });

  it('closes when a click lands outside the dropdown', () => {
    const { fixture, trigger, element } = render();
    document.body.appendChild(element);
    trigger().click();
    fixture.detectChanges();

    document.body.click();
    fixture.detectChanges();
    expect(element.querySelector('.dropdown-menu')).toBeNull();

    element.remove();
  });

  it('positions the menu as fixed, not clipped by a scrolling ancestor', () => {
    // Several toolbars in this app scroll horizontally; a plain absolutely-positioned menu would
    // be clipped by that overflow the moment it reached past the toolbar's bottom edge.
    const { fixture, trigger, element } = render();
    trigger().click();
    fixture.detectChanges();

    const menu = instance(element.querySelector('.dropdown-menu'), HTMLElement);
    expect(getComputedStyle(menu).position).toBe('fixed');
    expect(menu.style.top).not.toBe('');
    expect(menu.style.left).not.toBe('');
  });

  it('closes if something scrolls while it is open, instead of floating away from its trigger', () => {
    const { fixture, trigger, element } = render();
    document.body.appendChild(element);
    trigger().click();
    fixture.detectChanges();
    expect(element.querySelector('.dropdown-menu')).not.toBeNull();

    document.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(element.querySelector('.dropdown-menu')).toBeNull();

    element.remove();
  });

  it('moves the active option with the arrow keys and selects it with Enter', () => {
    const { fixture, trigger, element } = render();
    trigger().click();
    fixture.detectChanges();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(element.querySelector('.dropdown-option.active')?.textContent).toContain('Pear');

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.value).toBe('pear');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });
});
