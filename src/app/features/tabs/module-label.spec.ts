import { describe, expect, it } from 'vitest';
import { moduleLabel } from './module-label';

describe('short module names', () => {
  it('uses the company short forms for known modules', () => {
    expect(moduleLabel('DASHBOARD')).toBe('Dash');
    expect(moduleLabel('LICENSE MANAGER')).toBe('LM');
    expect(moduleLabel('ADMIN')).toBe('Adm');
  });

  it('shortens unknown modules automatically', () => {
    expect(moduleLabel('NEW REPORTING AREA')).toBe('NRA');
    expect(moduleLabel('ANALYTICS')).toBe('ANAL');
    expect(moduleLabel('KPI')).toBe('KPI');
  });
});
