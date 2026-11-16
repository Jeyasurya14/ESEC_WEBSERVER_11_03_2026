import { TabService } from '../../../features/tabs/tab.service';
import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ApiService } from '../../../core/api/api.service';
import { Division } from './division';

describe('License / Division', () => {
  it('renders the report filters and grid', async () => {
    TestBed.configureTestingModule({
      providers: [
        TabService,
        {
          provide: ApiService,
          useValue: {
            getSetting: () => '',
            query: () => of({ status: 'PASS', message: [] }),
            call: (sql: string) =>
              sql.includes('a_user_pref_load') ? of({ status: 'PASS', message: [] }) : NEVER,
            write: () => NEVER,
            post: () => NEVER,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Division);
    fixture.componentRef.setInput('menu', { mainMenuName: 'LICENSE', subMenuName: 'Division' });
    fixture.detectChanges();
    // Pending report resources intentionally keep Angular unstable.
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();

    const page: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance.reportLevel()).toBe('division');
    expect(page.querySelector('[aria-label="Division filters"]')).not.toBeNull();
    expect(page.querySelector('app-data-grid')).not.toBeNull();
    expect(page.classList.contains('report-page')).toBe(true);
  });
});
