import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { shortModuleName } from './short-name';
import { TAB_ID, Tab, TabService } from './tab.service';

const MENU_WIDTH_PX = 190;
const MENU_HEIGHT_PX = 190;

type MenuAction = 'closeAll' | 'closeOthers' | 'closeLeft' | 'closeRight' | 'togglePin';

interface MenuItem {
  action: MenuAction;
  label: string;
}

interface OpenMenu {
  tab: Tab;
  x: number;
  y: number;
}

@Component({
  selector: 'app-tabs',
  imports: [NgComponentOutlet],
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsComponent {
  readonly tabService = inject(TabService);
  readonly shortName = shortModuleName;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly parentInjector = inject(Injector);

  readonly menu = signal<OpenMenu | null>(null);

  // One child injector per tab, created once and reused - ngComponentOutlet recreates its
  // component whenever the injector it's given is a different object, so this must stay stable
  // for as long as the tab stays open.
  private readonly tabInjectors = new Map<number, Injector>();

  injectorFor(tab: Tab): Injector {
    let tabInjector = this.tabInjectors.get(tab.id);
    if (!tabInjector) {
      tabInjector = Injector.create({
        parent: this.parentInjector,
        providers: [{ provide: TAB_ID, useValue: tab.id }],
      });
      this.tabInjectors.set(tab.id, tabInjector);
    }
    return tabInjector;
  }

  readonly menuItems = computed<MenuItem[]>(() => {
    const openMenu = this.menu();
    if (!openMenu) {
      return [];
    }

    const { tab } = openMenu;
    const items: MenuItem[] = [];

    if (!tab.pinned) {
      items.push(
        { action: 'closeAll', label: 'Close All' },
        { action: 'closeOthers', label: 'Close All But This' },
      );
    }
    if (this.tabService.canCloseLeftOf(tab.id)) {
      items.push({ action: 'closeLeft', label: 'Close Tabs to the Left' });
    }
    if (this.tabService.canCloseRightOf(tab.id)) {
      items.push({ action: 'closeRight', label: 'Close Tabs to the Right' });
    }
    items.push({ action: 'togglePin', label: tab.pinned ? 'Unpin Tab' : 'Pin Tab' });
    return items;
  });

  isActive(tab: Tab): boolean {
    return tab.id === this.tabService.activeId();
  }

  openMenu(event: MouseEvent, tab: Tab): void {
    event.preventDefault();
    this.tabService.activate(tab.id);

    this.menu.set({
      tab,
      x: Math.min(event.clientX, window.innerWidth - MENU_WIDTH_PX),
      y: Math.min(event.clientY, window.innerHeight - MENU_HEIGHT_PX),
    });
  }

  run(action: MenuAction): void {
    const openMenu = this.menu();

    if (openMenu) {
      const { id } = openMenu.tab;

      switch (action) {
        case 'closeAll':
          this.tabService.closeAll();
          break;
        case 'closeOthers':
          this.tabService.closeOthers(id);
          break;
        case 'closeLeft':
          this.tabService.closeLeftOf(id);
          break;
        case 'closeRight':
          this.tabService.closeRightOf(id);
          break;
        case 'togglePin':
          this.tabService.togglePin(id);
          break;
      }
    }
    this.closeMenu();
  }

  onKeydown(event: KeyboardEvent, tab: Tab): void {
    if (event.key === 'Delete') {
      this.tabService.close(tab.id);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.focusNeighbour(tab, event.key === 'ArrowRight' ? 1 : -1);
    }
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  @HostListener('window:resize')
  closeMenu(): void {
    this.menu.set(null);
  }

  private focusNeighbour(tab: Tab, step: 1 | -1): void {
    const openTabs = this.tabService.tabs();
    const neighbourTab =
      openTabs[(openTabs.indexOf(tab) + step + openTabs.length) % openTabs.length];

    this.tabService.activate(neighbourTab.id);
    this.host.nativeElement.querySelector<HTMLElement>(`#tab-${neighbourTab.id}`)?.focus();
  }
}
