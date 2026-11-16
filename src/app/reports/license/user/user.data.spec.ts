import { describe, expect, it } from 'vitest';
import { userCall, userColumns } from './user.data';

describe('License User data rules', () => {
  it('calls r_license_user for the signed-in user', () => {
    expect(userCall('john')).toBe("call esms_m.r_license_user('john');");
  });

  it('escapes quotes in the user id', () => {
    expect(userCall("o'neil")).toBe("call esms_m.r_license_user('o''neil');");
  });

  it('groups the user, access and denial columns', () => {
    const groupNames = userColumns()
      .filter((column) => 'children' in column)
      .map((column) => column.headerName);
    expect(groupNames).toEqual(['User', 'Access', 'Denial']);
  });
});
