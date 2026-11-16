import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  viewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { UserMenu } from '../../../core/models';
import { SidebarPanelComponent } from '../sidebar-panel/sidebar-panel.component';
import {
  DEFAULT_MODULE_ICON,
  LICENSE_MANAGER_MENU,
  LICENSE_MANAGER_SHORTCUTS,
  MODULE_ICONS,
  PANEL_BOTTOM_GAP_PX,
  PANEL_HEIGHT_PX,
} from './sidebar.config';

@Component({
  selector: 'app-sidebar',
  imports: [SidebarPanelComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'dismissSidebarOnEscape()',
    '(window:resize)': 'closeOnResize()',
    '(document:click)': 'dismissSidebarOnOutsideClick($event)',
  },
})
export class SidebarComponent {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly sidebar = viewChild<ElementRef<HTMLElement>>('sidebar');
  private panelTrigger?: HTMLButtonElement;

  readonly modules = input<string[]>([]);
  readonly menus = input<UserMenu[]>([]);
  readonly selectedMenu = input<UserMenu | null>(null);
  readonly menuSelected = output<UserMenu>();

  readonly licenseManagerMenu = LICENSE_MANAGER_MENU;
  readonly selectedModule = signal('');
  readonly panelOpen = signal(false);
  readonly panelTop = signal(0);

  readonly moduleScreens = computed(() => {
    return this.menus().filter((menu) => menu.mainMenuName === this.selectedModule());
  });

  private readonly licenseMenus = computed(() => {
    const menus = new Map<string, UserMenu>();
    for (const menu of this.menus()) {
      if (menu.mainMenuName === LICENSE_MANAGER_MENU && !menus.has(menu.subMenuName))
        menus.set(menu.subMenuName, menu);
    }
    return menus;
  });
  readonly shortcuts = computed(() =>
    LICENSE_MANAGER_SHORTCUTS.map(({ letter, title, screen }) => ({
      letter,
      title,
      menu: this.licenseMenus().get(screen),
    })),
  );

  constructor() {
    effect(() => {
      const menu = this.selectedMenu();
      if (menu) this.selectedModule.set(menu.mainMenuName);
    });
  }

  getIcon(moduleName: string): string {
    const filename = MODULE_ICONS[moduleName] ?? DEFAULT_MODULE_ICON;
    return `assets/icons/flaticon/${filename}.svg`;
  }

  openModule(moduleName: string, button: HTMLButtonElement): void {
    const sidebar = this.sidebar()?.nativeElement;

    if (!sidebar) {
      return;
    }

    const buttonTop = button.getBoundingClientRect().top - sidebar.getBoundingClientRect().top;
    const lowestTop = Math.max(0, sidebar.clientHeight - PANEL_HEIGHT_PX - PANEL_BOTTOM_GAP_PX);
    this.panelTop.set(Math.max(0, Math.min(buttonTop, lowestTop)));
    this.panelTrigger = button;

    if (this.selectedModule() === moduleName) {
      this.panelOpen.update((open) => !open);
    } else {
      this.selectedModule.set(moduleName);
      this.panelOpen.set(true);
    }
  }

  selectSidebarReport(menu: UserMenu | undefined): void {
    if (!menu) {
      return;
    }

    this.selectedModule.set(menu.mainMenuName);
    this.menuSelected.emit(menu);
    this.closePanel();
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.panelTrigger?.focus();
  }

  dismissSidebarOnEscape(): void {
    if (this.panelOpen()) {
      this.closePanel();
    }
  }

  closeOnResize(): void {
    this.panelOpen.set(false);
  }

  dismissSidebarOnOutsideClick(event: MouseEvent): void {
    if (!(event.target instanceof Node) || !this.element.nativeElement.contains(event.target)) {
      this.panelOpen.set(false);
    }
  }
}
