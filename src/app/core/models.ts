/** Shapes shared across the app. Items marked "wire" mirror the database/server contract. */

export type LoginType = 'AD LOGIN' | 'ESEC LOGIN' | 'ADMIN';

/** Every server reply is wrapped in this envelope. `status` is 'PASS' on success. */
export interface ApiResult<T> {
  status: string;
  message: T;
}

/** wire: assets/config.json */
export interface ServerConfig {
  NODE_IP: string;
  NODE_PORT: string;
  CENTRALIZED: boolean | string;
}

/** wire: a row of the ESEC settings table, or an entry of assets/settings.json */
export interface Setting {
  _DESC: string;
  _VALUE: string;
}

/** wire: one top-level menu and its comma-separated screens */
export interface MenuDefinition {
  RT_M_REF_NO: number;
  RT_M_NAME: string;
  RT_M_LIST: string;
}

/** wire: the user's stored permission list, e.g. "DASHBOARD_CONFIGURATION,ADMIN_USER" */
export interface MenuPermissionRow {
  RT_A_LIST: string | null;
}

/** wire: a user profile comes back as name/value rows, one per field */
export interface UserDetailRow {
  _DESC: string;
  _VALUE: string | number | null;
}

export interface UserDetails {
  userId: string;
  userName: string;
  department: string;
  status: string;
}

/** A screen the user may open: one entry in one top-level menu. */
export interface UserMenu {
  mainMenuName: string;
  subMenuName: string;
}
