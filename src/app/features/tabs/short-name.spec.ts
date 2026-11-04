import { describe, expect, it } from 'vitest';
import { shortModuleName } from './short-name';

describe('short module names', () => {
  it('uses the company short forms for known modules', () => {
    expect(shortModuleName('DASHBOARD')).toBe('Dash');
    expect(shortModuleName('LICENSE MANAGER')).toBe('LM');
    expect(shortModuleName('ADMIN')).toBe('Adm');
  });

  it('shortens unknown modules automatically', () => {
    expect(shortModuleName('NEW REPORTING AREA')).toBe('NRA');
    expect(shortModuleName('ANALYTICS')).toBe('ANAL');
    expect(shortModuleName('KPI')).toBe('KPI');
  });
});
