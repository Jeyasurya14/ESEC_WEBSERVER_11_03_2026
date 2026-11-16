import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LoginService } from './core/auth/login.service';
import { StartupComponent } from './features/startup/startup.component';
import { LoginComponent } from './features/login/login.component';
import { HomeComponent } from './features/home/home.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [StartupComponent, LoginComponent, HomeComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly loginService = inject(LoginService);

  readonly currentScreen = computed(() => {
    if (!this.loginService.isLicenseReady()) {
      return 'startup';
    }
    return this.loginService.isAuthenticated() ? 'home' : 'login';
  });
}
