import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { evaluateLicense } from '../../core/license/license';
import { LoginService } from '../../core/auth/login.service';
import { APP_VERSION } from '../../core/app-version';
import { BrowserStorage, StorageKey } from '../../core/storage/browser-storage.service';
import { formatDate } from '../../shared/dates';

type StartupState =
  | { kind: 'connecting' }
  | { kind: 'blocked'; message: string }
  | { kind: 'renewal-reminder'; message: string };

@Component({
  selector: 'app-onstart',
  templateUrl: './onstart.component.html',
  styleUrl: './onstart.component.scss',
})
export class OnstartComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly loginService = inject(LoginService);
  private readonly storage = inject(BrowserStorage);

  readonly state = signal<StartupState>({ kind: 'connecting' });
  readonly message = computed(() => {
    const state = this.state();
    return state.kind === 'connecting' ? '' : state.message;
  });

  ngOnInit(): void {
    void this.start();
  }

  async start(): Promise<void> {
    this.loginService.setLicenceReady(false);
    this.state.set({ kind: 'connecting' });
    
    try {
      await this.api.loadSettings();
      await this.checkLicense();     
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      this.block(
        timedOut
          ? 'Request Timed Out - Please check your connection'
          : 'Unable to load configuration or connect to the Node server.',
      );
    }
  }

  continueAfterReminder(): Promise<void> {
    return this.enterApplication();
  }

  private async checkLicense(): Promise<void> {
    const reply = await firstValueFrom(
      this.api.query<Array<{ ESEC_VALUE: string }>>(
        "SELECT ESEC_VALUE FROM esms.cltx_esec WHERE ESEC_DESC = 'LICENSE_WEB'",
      ),
    );
    if (reply.status !== 'PASS') {
      return this.block('Database Server - Connection Error');
    }

    const stored = Array.isArray(reply.message) ? reply.message[0]?.ESEC_VALUE : undefined;
    const license = evaluateLicense(stored, new Date());

    switch (license.status) {
      case 'invalid':
        return this.block('Invalid License');
      case 'expired':
        return this.block('License Expired');
      case 'expiring':
        return this.state.set({
          kind: 'renewal-reminder',
          message: `License valid until ${license.expiryText}. Please renew soon.`,
        });
      case 'valid':
        return this.enterApplication();
    }
  }

  private async enterApplication(): Promise<void> {
    if (this.api.getSetting('UNDER_MAINTENANCE') === 'TRUE') {
      return this.block(this.api.getSetting('UNDER_MAINTENANCE_MSG') || 'ESEC is under maintenance.');
    }

    this.storage.set(StorageKey.today, formatDate(new Date()));
    this.storage.set(StorageKey.version, APP_VERSION);

    // A user remembered from before a page reload goes straight back to the home screen.
    await this.loginService.restoreSession();
    this.loginService.setLicenceReady(true);
  }

  private block(message: string): void {
    this.state.set({ kind: 'blocked', message });
  }
}
