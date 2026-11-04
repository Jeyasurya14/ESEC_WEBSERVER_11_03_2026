import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SidebarPanelComponent } from './sidebar-panel.component';

describe('selected report identity', () => {
  it('does not mark a same-named report in another module as selected', () => {
    const fixture = TestBed.createComponent(SidebarPanelComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('screens', [
      { mainMenuName: 'LICENSE', subMenuName: 'Department' }
    ]);
    fixture.componentRef.setInput('selectedMenu', {
      mainMenuName: 'DASHBOARD', subMenuName: 'Department'
    });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.action-chip') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.classList.contains('active')).toBe(false);
  });
});
