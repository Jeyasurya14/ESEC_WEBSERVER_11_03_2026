import { GridFixture } from '../../../../testing/grid-fixture';
import { describe, expect, it, vi } from 'vitest';
import {
  FeatureRow,
  addFeatureCall,
  allFeaturesCall,
  createGroupCall,
  featureKey,
  groupFeaturesCall,
  myFeatureColumns,
  removeFeatureCall,
  selectionChanges,
} from './feature-groups.data';

function row(server: string, feature: string): FeatureRow {
  return { FEATURE_SELECT: 'N', SOFT_NAME: 'Matlab', SERVER: server, FEATURE: feature };
}

describe('My Feature calls', () => {
  it("lists every feature, and one group's selection", () => {
    expect(allFeaturesCall('john')).toBe("call esms.R_A_CLTX_ESEC_MF_LICENSE_ALL('john');");
    expect(groupFeaturesCall('john', ' CATIA ')).toBe(
      "call R_A_CLTX_ESEC_MF_LICENSE_LIST('john','CATIA');",
    );
  });

  it('creates a group and adds or removes one feature at a time, quoting every value', () => {
    expect(createGroupCall('john', "O'Neil")).toBe(
      "call R_A_CLTX_ESEC_MF_CREATE('john','O''Neil');",
    );
    expect(addFeatureCall('john', 'CATIA', row('srv-01', 'HD2'))).toBe(
      "call R_A_CLTX_ESEC_MF_ADD('john','CATIA','srv-01','HD2');",
    );
    expect(removeFeatureCall('john', 'CATIA', row('srv-01', 'HD2'))).toBe(
      "call R_A_CLTX_ESEC_MF_remove('john','CATIA','srv-01','HD2');",
    );
  });
});

describe('My Feature selection', () => {
  const rows = [row('a', '1'), row('a', '2'), row('b', '1')];

  it('saves only what changed against what the group held on load', () => {
    const saved = new Set([featureKey(rows[0]), featureKey(rows[1])]);
    const selected = new Set([featureKey(rows[1]), featureKey(rows[2])]);

    const { added, removed } = selectionChanges(rows, saved, selected);
    expect(added).toEqual([rows[2]]);
    expect(removed).toEqual([rows[0]]);
  });

  it('tells the same feature apart on different servers', () => {
    expect(featureKey(rows[0])).not.toBe(featureKey(rows[2]));
  });

  it('toggles a row when its Select cell is clicked', () => {
    const onToggle = vi.fn();
    const selectColumn = myFeatureColumns(onToggle).find(
      (column) => 'colId' in column && column.colId === 'FEATURE_SELECT',
    );
    const onCellClicked =
      selectColumn && 'onCellClicked' in selectColumn ? selectColumn.onCellClicked : undefined;

    using grid = new GridFixture(rows[0]);
    onCellClicked?.(grid.click(rows[0]));
    expect(onToggle).toHaveBeenCalledWith(rows[0]);
  });
});
