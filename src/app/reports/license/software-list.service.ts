import { apiRequest } from '../../core/api/api-request';
import { Injectable, inject, DestroyRef } from '@angular/core';

import { ApiService } from '../../core/api/api.service';
import { LicenseRecord } from './report-helpers';

@Injectable({ providedIn: 'root' })
export class SoftwareListService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly api = inject(ApiService);
  private softwarePromise: Promise<string[]> | null = null;
  load(): Promise<string[]> {
    this.softwarePromise ??= this.fetch().catch((error: unknown) => {
      this.softwarePromise = null;
      throw error;
    });
    return this.softwarePromise;
  }
  private async fetch(): Promise<string[]> {
    const response = await apiRequest(
      this.api.call<LicenseRecord[]>('call esms_m.r_license_usage_sw_list();'),
      this.destroyRef,
    );
    if (response.status !== 'PASS' || !Array.isArray(response.message))
      throw new Error('Unable to load software names.');
    return [
      ...new Set(
        response.message.map((row) => String(row['sw'] ?? row['exe'] ?? '')).filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));
  }
}
