import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LoginService } from '../../core/auth/login.service';
import { UserMenu } from '../../core/models';
import { RefreshButton } from '../../shared/refresh-button/refresh-button';
import { TabService } from '../tabs/tab.service';
import { TabsComponent } from '../tabs/tabs.component';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';

@Component({
  selector: 'app-home',
  imports: [HeaderComponent, RefreshButton, SidebarComponent, TabsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  providers: [TabService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly loginService = inject(LoginService);
  private readonly tabs = inject(TabService);

  readonly selectedMenu = computed(() => this.tabs.activeTab()?.menu ?? null);
  readonly hasTabs = computed(() => this.tabs.tabs().length > 0);
  /** The active tab's refresh control, if it put one up - see TabService.setRefreshHandle. */
  readonly refreshHandle = computed(() => this.tabs.activeRefreshHandle());
  readonly sidebarVisible = signal(true);
  readonly notice = signal('');

  async openReport(menu: UserMenu): Promise<void> {
    const permittedMenu = this.loginService.menus().find((item) => {
      return item.mainMenuName === menu.mainMenuName && item.subMenuName === menu.subMenuName;
    });
    if (!permittedMenu) {
      return;
    }

    this.notice.set('');
    try {
      await this.tabs.open(permittedMenu);
    } catch {
      this.notice.set(`Could not open ${permittedMenu.subMenuName}. Please try again.`);
    }
  }

  toggleSidebar(): void {
    this.sidebarVisible.update((visible) => !visible);
  }

  showProfileAction(action: string): void {
    this.notice.set(action + ' is not available in this application yet.');
  }

  returnToLogin(): void {
    this.loginService.signOut();
  }
}
