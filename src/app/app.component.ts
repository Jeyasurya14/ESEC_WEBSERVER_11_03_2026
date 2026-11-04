import { Component, computed, inject } from '@angular/core';
import { LoginService } from './core/auth/login.service';
import { OnstartComponent } from './features/onstart/onstart.component';
import { LoginComponent } from './features/login/login.component';
import { HomeComponent } from './features/home/home.component';

@Component({
  selector: 'app-root',
  imports: [OnstartComponent, LoginComponent, HomeComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private readonly loginService = inject(LoginService);

  public dummy: boolean = false
  readonly currentScreen = computed(() => {
    if (!this.loginService.licenceReady()) {

      return 'startup';
    }
    return this.loginService.isAuthenticated() ? 'home' : 'login';
  });
}