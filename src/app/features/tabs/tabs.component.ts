import { assertNever } from '../../core/utils/data';
import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyableInjector,
  ElementRef,
  Injector,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { moduleLabel } from './module-label';
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
  host: {
    '(document:click)': 'closeMenu()',
    '(document:keydown.escape)': 'closeMenu()',
    '(window:resize)': 'closeMenu()',
  },
})
export class TabsComponent implements OnDestroy {
  readonly tabService = inject(TabService);
  readonly moduleLabel = moduleLabel;
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly parentInjector = inject(Injector);

  readonly contextMenu = signal<OpenMenu | null>(null);

  private readonly tabInjectors = new Map<number, DestroyableInjector>();

  constructor() {
    effect(() => {
      const openIds = new Set(this.tabService.tabs().map((tab) => tab.id));
      for (const [tabId, injector] of this.tabInjectors) {
        if (!openIds.has(tabId)) {
          injector.destroy();
          this.tabInjectors.delete(tabId);
        }
      }
      const menu = this.contextMenu();
      if (menu && !openIds.has(menu.tab.id)) this.closeMenu();
    });
  }

  ngOnDestroy(): void {
    for (const injector of this.tabInjectors.values()) injector.destroy();
    this.tabInjectors.clear();
  }

  injectorFor(tab: Tab): DestroyableInjector {
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
    const openMenu = this.contextMenu();
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
    return tab.id === this.tabService.activeTabId();
  }

  openMenu(event: MouseEvent, tab: Tab): void {
    event.preventDefault();
    this.tabService.activate(tab.id);

    this.contextMenu.set({
      tab,
      x: Math.max(0, Math.min(event.clientX, window.innerWidth - MENU_WIDTH_PX)),
      y: Math.max(0, Math.min(event.clientY, window.innerHeight - MENU_HEIGHT_PX)),
    });
  }

  run(action: MenuAction): void {
    const openMenu = this.contextMenu();
    if (!openMenu) return;
    const { id: tabId } = openMenu.tab;
    switch (action) {
      case 'closeAll':
        this.tabService.closeAll();
        break;
      case 'closeOthers':
        this.tabService.closeOthers(tabId);
        break;
      case 'closeLeft':
        this.tabService.closeLeftOf(tabId);
        break;
      case 'closeRight':
        this.tabService.closeRightOf(tabId);
        break;
      case 'togglePin':
        this.tabService.togglePin(tabId);
        break;
      default:
        assertNever(action);
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

  closeMenu(): void {
    this.contextMenu.set(null);
  }

  private focusNeighbour(tab: Tab, step: 1 | -1): void {
    const openTabs = this.tabService.tabs();
    if (!openTabs.length) return;
    const neighbourTab =
      openTabs[(openTabs.indexOf(tab) + step + openTabs.length) % openTabs.length];

    this.tabService.activate(neighbourTab.id);
    this.hostElement.nativeElement.querySelector<HTMLElement>(`#tab-${neighbourTab.id}`)?.focus();
  }
}
