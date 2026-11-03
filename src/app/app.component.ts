import { Component, computed, inject } from '@angular/core';
import { LoginService } from './services/login.service';
import { OnstartComponent } from './onstart/onstart.component';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';

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