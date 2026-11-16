import { describe, expect, it } from 'vitest';
import { debugDataCall, debugDataColumns } from './debug-data.data';

describe('License Debug Data data rules', () => {
  it('calls r_license_debug_data with no arguments', () => {
    expect(debugDataCall()).toBe('call esms_m.r_license_debug_data();');
  });

  it('hides the location column by default', () => {
    const location = debugDataColumns().find(
      (column) => 'field' in column && column.field === 'location',
    );
    expect(location && 'hide' in location ? location.hide : undefined).toBe(true);
  });
});
