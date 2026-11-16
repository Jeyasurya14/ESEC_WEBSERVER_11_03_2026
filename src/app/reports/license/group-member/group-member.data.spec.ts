import { describe, expect, it } from 'vitest';
import { groupMemberCall, groupMemberColumns } from './group-member.data';

describe('Group Member data rules', () => {
  it('calls the group member procedure with no arguments', () => {
    expect(groupMemberCall()).toBe('call esms_m.r_license_group_member();');
  });

  it('groups the group, start and last-updated columns as the company app does', () => {
    const groupHeaders = groupMemberColumns()
      .filter((column) => 'children' in column)
      .map((column) => column.headerName);
    expect(groupHeaders).toEqual(['Group', 'Start', 'Last Updated']);
  });
});
