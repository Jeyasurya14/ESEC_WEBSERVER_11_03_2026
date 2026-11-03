import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LoginService } from '../services/login.service';
import { UserMenu } from '../models';
import { TabService } from '../tabs/tab.service';
import { TabsComponent } from '../tabs/tabs.component';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';

@Component({
  selector: 'app-home',
  imports: [HeaderComponent, SidebarComponent, TabsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  // Provided here, not in root, so signing out (which destroys Home) discards every open tab.
  providers: [TabService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly loginService = inject(LoginService);
  private readonly tabs = inject(TabService);

  /** The report in the front tab; the sidebar highlights it. */
  readonly selectedMenu = computed(() => this.tabs.activeTab()?.menu ?? null);
  readonly hasTabs = computed(() => this.tabs.tabs().length > 0);
  readonly sidebarVisible = signal(true);
  readonly notice = signal('');

  /** Opens a report in a new tab, if the user is permitted to see it. */
  async openReport(menu: UserMenu): Promise<void> {
    const permitted = this.loginService.menus().find((item) => {
      return item.mainMenuName === menu.mainMenuName && item.subMenuName === menu.subMenuName;
    });
    if (!permitted) {
      return;
    }

    this.notice.set('');
    try {
      await this.tabs.open(permitted);
    } catch {
      this.notice.set(`Could not open ${permitted.subMenuName}. Please try again.`);
    }
  }

  toggleSidebar(): void {
    this.sidebarVisible.update((visible) => !visible);
  }

  showProfileAction(action: string): void {
    this.notice.set(action + ' is not available in this application yet.');
  }

  returnToLogin(): void {
    this.loginService.clearSession();
  }
}
