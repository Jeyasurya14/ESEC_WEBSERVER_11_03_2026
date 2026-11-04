import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { LoginService, LoginType } from '../../core/auth/login.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly loginService = inject(LoginService);
  private readonly api = inject(ApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly passwordVisible = signal(false);
  readonly loginType = signal<LoginType>('AD LOGIN');

  readonly loginTitle = this.api.getSetting('LOGIN_TITLE') || 'ESEC Login';
  readonly showEsecLogin = this.api.getSetting('ESEC_LOGIN') === 'TRUE';
  readonly adUsernamePlaceholder = this.api.getSetting('LOGIN_USER_PLACEHOLDER');
  readonly adPasswordPlaceholder = this.api.getSetting('LOGIN_PASSWORD_PLACEHOLDER');

    readonly form = this.formBuilder.nonNullable.group({
      loginType: ['AD LOGIN' as LoginType, Validators.required],
      username: ['', Validators.required],
      password: ['', Validators.required],
    });

  onLoginTypeChange(): void {
    const selectedType = this.form.controls.loginType.value;
    const username = this.form.controls.username;

    this.loginType.set(selectedType);
    this.errorMessage.set('');
    this.form.controls.password.reset();
    
    if (selectedType === 'ADMIN') {
      username.setValue('admin');
      username.disable();
    } else {
      username.enable();
      username.reset();
    }
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  async submitLoginForm(): Promise<void> {
    if (this.isSubmitting()) {
      return;
    }

    this.errorMessage.set('');
    const { loginType, username, password } = this.form.getRawValue();

    if (this.form.invalid || username.trim() === '') {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please enter your User ID and Password.');
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.loginService.signInUser(loginType, username, password);
    } catch (error) {
      const isNetworkFailure =
        !(error instanceof Error) || error.name === 'HttpErrorResponse' || error.name === 'TimeoutError';
      this.errorMessage.set(
        isNetworkFailure
          ? 'Unable to connect or complete sign-in. Please try again.'
          : (error as Error).message,
      );
    } finally {
      this.form.controls.password.reset();
      this.isSubmitting.set(false);
    }
  }
}
