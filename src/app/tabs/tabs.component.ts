import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { Tab, TabService } from './tab.service';

const MENU_WIDTH_PX = 190;
const MENU_HEIGHT_PX = 190;

/** The tab strip, the right-click menu, and the open reports (all kept alive, one visible). */
@Component({
  selector: 'app-tabs',
  imports: [NgComponentOutlet],
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsComponent {
  readonly tabService = inject(TabService);

  /** The tab the right-click menu is open for, and where to draw it. */
  readonly menu = signal<{ tab: Tab; x: number; y: number } | null>(null);

  openMenu(event: MouseEvent, tab: Tab): void {
    event.preventDefault();
    this.tabService.activate(tab.id);

    // Keep the menu fully on screen.
    const x = Math.min(event.clientX, window.innerWidth - MENU_WIDTH_PX);
    const y = Math.min(event.clientY, window.innerHeight - MENU_HEIGHT_PX);
    this.menu.set({ tab, x, y });
  }

  /** Runs a right-click menu action on the tab the menu was opened for, then closes the menu. */
  run(action: 'closeAll' | 'closeOthers' | 'closeLeft' | 'closeRight' | 'togglePin'): void {
    const id = this.menu()?.tab.id;

    if (id !== undefined) {
      const actions = {
        closeAll: () => this.tabService.closeAll(),
        closeOthers: () => this.tabService.closeOthers(id),
        closeLeft: () => this.tabService.closeLeftOf(id),
        closeRight: () => this.tabService.closeRightOf(id),
        togglePin: () => this.tabService.togglePin(id),
      };
      actions[action]();
    }
    this.closeMenu();
  }

  /** Arrow keys move between tabs, Delete closes the focused one. */
  onKeydown(event: KeyboardEvent, tab: Tab): void {
    const tabs = this.tabService.tabs();
    const index = tabs.indexOf(tab);

    if (event.key === 'Delete') {
      this.tabService.close(tab.id);
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    this.tabService.activate(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  @HostListener('window:resize')
  closeMenu(): void {
    this.menu.set(null);
  }
}
