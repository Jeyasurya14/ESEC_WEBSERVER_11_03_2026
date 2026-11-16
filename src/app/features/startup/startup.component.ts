import { assertNever } from '../../core/utils/data';
import { apiRequest, resourceRequest } from '../../core/api/api-request';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  Injector,
} from '@angular/core';

import { ApiService } from '../../core/api/api.service';
import { evaluateLicense } from '../../core/license/license-check';
import { LoginService } from '../../core/auth/login.service';
import { APP_VERSION } from '../../core/app-version';
import { BrowserStorage, StorageKey } from '../../core/storage/browser-storage.service';
import { formatDate } from '../../shared/dates';

type StartupState =
  | { kind: 'connecting' }
  | { kind: 'blocked'; message: string }
  | { kind: 'renewal-reminder'; message: string };

@Component({
  selector: 'app-startup',
  standalone: true,
  templateUrl: './startup.component.html',
  styleUrl: './startup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartupComponent implements OnInit {
  private readonly injector = inject(Injector);

  private readonly api = inject(ApiService);
  private readonly loginService = inject(LoginService);
  private readonly storage = inject(BrowserStorage);

  readonly startupStatus = signal<StartupState>({ kind: 'connecting' });
  readonly statusMessage = computed(() => {
    const startupState = this.startupStatus();
    switch (startupState.kind) {
      case 'connecting':
        return '';
      case 'blocked':
      case 'renewal-reminder':
        return startupState.message;
      default:
        return assertNever(startupState);
    }
  });

  ngOnInit(): void {
    void this.start();
  }

  async start(): Promise<void> {
    this.loginService.setLicenseReady(false);
    this.startupStatus.set({ kind: 'connecting' });

    try {
      await this.api.loadSettings();
      await this.checkLicense();
    } catch (error) {
      const requestTimedOut = error instanceof Error && error.name === 'TimeoutError';
      this.block(
        requestTimedOut
          ? 'Request Timed Out - Please check your connection'
          : 'Unable to load configuration or connect to the Node server.',
      );
    }
  }

  continueAfterReminder(): Promise<void> {
    return this.enterApplication();
  }

  private async checkLicense(): Promise<void> {
    const licenseResponse = await resourceRequest(this.injector, (abortSignal) =>
      apiRequest(
        this.api.query<Array<{ ESEC_VALUE: string }>>(
          "SELECT ESEC_VALUE FROM esms.cltx_esec WHERE ESEC_DESC = 'LICENSE_WEB'",
        ),
        abortSignal,
      ),
    );
    if (licenseResponse.status !== 'PASS') {
      return this.block('Database Server - Connection Error');
    }

    const encryptedLicense = Array.isArray(licenseResponse.message)
      ? licenseResponse.message[0]?.ESEC_VALUE
      : undefined;
    const licenseVerdict = evaluateLicense(encryptedLicense, new Date());

    switch (licenseVerdict.status) {
      case 'invalid':
        return this.block('Invalid License');
      case 'expired':
        return this.block('License Expired');
      case 'expiring':
        return this.startupStatus.set({
          kind: 'renewal-reminder',
          message: `License valid until ${licenseVerdict.expiryText}. Please renew soon.`,
        });
      case 'valid':
        return this.enterApplication();
      default:
        return assertNever(licenseVerdict);
    }
  }

  private async enterApplication(): Promise<void> {
    if (this.api.getSetting('UNDER_MAINTENANCE') === 'TRUE') {
      return this.block(
        this.api.getSetting('UNDER_MAINTENANCE_MSG') || 'ESEC is under maintenance.',
      );
    }

    this.storage.set(StorageKey.today, formatDate(new Date()));
    this.storage.set(StorageKey.version, APP_VERSION);

    // A user remembered from before a page reload goes straight back to the home screen.
    await this.loginService.restoreSession();
    this.loginService.setLicenseReady(true);
  }

  private block(message: string): void {
    this.startupStatus.set({ kind: 'blocked', message });
  }
}
