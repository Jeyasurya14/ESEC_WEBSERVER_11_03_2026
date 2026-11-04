import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnChanges,
  ViewChild,
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
})
export class SidebarComponent implements OnChanges {
  private readonly element = inject(ElementRef<HTMLElement>);
  @ViewChild('sidebar') private sidebar?: ElementRef<HTMLElement>;
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

  readonly shortcuts = computed(() => {
    return LICENSE_MANAGER_SHORTCUTS.map(({ letter, title, screen }) => {
      const menu = this.menus().find((item) => {
        return item.mainMenuName === LICENSE_MANAGER_MENU && item.subMenuName === screen;
      });

      return { letter, title, menu };
    });
  });

  ngOnChanges(): void {
    const menu = this.selectedMenu();

    if (menu) {
      this.selectedModule.set(menu.mainMenuName);
    }
  }

  getIcon(moduleName: string): string {
    const filename = MODULE_ICONS[moduleName] ?? DEFAULT_MODULE_ICON;
    return `assets/icons/flaticon/${filename}.svg`;
  }

  openModule(moduleName: string, button: HTMLButtonElement): void {
    const sidebar = this.sidebar?.nativeElement;

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

  @HostListener('document:keydown.escape')
  dismissSidebarOnEscape(): void {
    if (this.panelOpen()) {
      this.closePanel();
    }
  }

  @HostListener('window:resize')
  closeOnResize(): void {
    this.panelOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  dismissSidebarOnOutsideClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) {
      this.panelOpen.set(false);
    }
  }
}
