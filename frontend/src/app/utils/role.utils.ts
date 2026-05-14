/**
 * Role Management Utilities
 * Provides helper functions for role-based operations
 */

export type UserRole = 'super_admin' | 'owner' | 'admin' | 'support' | 'user' | 'guest';

export interface RoleInfo {
  name: UserRole;
  displayName: string;
  description: string;
  level: number;
  permissions: string[];
  requiresMFA: boolean;
  color: string;
  icon: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleInfo> = {
  super_admin: {
    name: 'super_admin',
    displayName: 'Super Administrator',
    description: 'Ultimate system access with all privileges',
    level: 5,
    permissions: [
      'manage_users',
      'manage_roles',
      'manage_properties',
      'manage_bookings',
      'manage_payments',
      'view_analytics',
      'manage_settings',
      'access_all_data',
      'manage_system',
      'system_administration',
      'global_configuration',
      'security_management'
    ],
    requiresMFA: true,
    color: 'purple',
    icon: 'fas fa-crown'
  },
  owner: {
    name: 'owner',
    displayName: 'Owner',
    description: 'Full system access and management',
    level: 4,
    permissions: [
      'manage_users',
      'manage_roles',
      'manage_properties',
      'manage_bookings',
      'manage_payments',
      'view_analytics',
      'manage_settings',
      'access_all_data',
      'manage_system'
    ],
    requiresMFA: true,
    color: 'red',
    icon: 'fas fa-user-crown'
  },
  admin: {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Administrative access except user management',
    level: 3,
    permissions: [
      'manage_properties',
      'manage_bookings',
      'manage_payments',
      'view_analytics',
      'manage_settings',
      'access_most_data',
      'view_users'
    ],
    requiresMFA: true,
    color: 'blue',
    icon: 'fas fa-user-shield'
  },
  support: {
    name: 'support',
    displayName: 'Support',
    description: 'Customer support and booking management',
    level: 2,
    permissions: [
      'manage_bookings',
      'view_bookings',
      'access_chat',
      'view_customer_data',
      'update_booking_status',
      'process_refunds'
    ],
    requiresMFA: false,
    color: 'green',
    icon: 'fas fa-headset'
  },
  user: {
    name: 'user',
    displayName: 'User',
    description: 'Regular user with personal data access',
    level: 1,
    permissions: [
      'view_own_bookings',
      'manage_own_profile',
      'make_bookings',
      'cancel_own_bookings',
      'update_own_data'
    ],
    requiresMFA: false,
    color: 'gray',
    icon: 'fas fa-user'
  },
  guest: {
    name: 'guest',
    displayName: 'Guest',
    description: 'Limited access for browsing and booking',
    level: 0,
    permissions: [
      'view_properties',
      'make_bookings',
      'view_public_data'
    ],
    requiresMFA: false,
    color: 'gray',
    icon: 'fas fa-user-circle'
  }
};

/**
 * Get role information by role name
 */
export function getRoleInfo(role: UserRole): RoleInfo {
  return ROLE_DEFINITIONS[role];
}

/**
 * Get all available roles
 */
export function getAllRoles(): RoleInfo[] {
  return Object.values(ROLE_DEFINITIONS);
}

/**
 * Get roles that can be managed by a specific role
 */
export function getManageableRoles(userRole: UserRole): RoleInfo[] {
  const userLevel = ROLE_DEFINITIONS[userRole].level;

  // Super admin can manage all roles
  if (userRole === 'super_admin') {
    return getAllRoles();
  }

  // Owner can manage all except super admin
  if (userRole === 'owner') {
    return getAllRoles().filter(role => role.name !== 'super_admin');
  }

  // Others cannot manage roles
  return [];
}

/**
 * Check if a role can manage another role
 */
export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  const manageableRoles = getManageableRoles(managerRole);
  return manageableRoles.some(role => role.name === targetRole);
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_DEFINITIONS[role].permissions.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: string[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a user role matches any of the specified roles
 */
export function hasAnyRole(userRole: UserRole, roles: UserRole[]): boolean {
  return roles.includes(userRole);
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: string[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Compare role levels
 */
export function isRoleHigherOrEqual(role1: UserRole, role2: UserRole): boolean {
  return ROLE_DEFINITIONS[role1].level >= ROLE_DEFINITIONS[role2].level;
}

/**
 * Get the highest role from a list of roles
 */
export function getHighestRole(roles: UserRole[]): UserRole | null {
  if (roles.length === 0) return null;

  return roles.reduce((highest, current) => {
    return ROLE_DEFINITIONS[current].level > ROLE_DEFINITIONS[highest].level ? current : highest;
  });
}

/**
 * Get role display name with proper formatting
 */
export function formatRoleName(role: UserRole): string {
  return ROLE_DEFINITIONS[role].displayName;
}

/**
 * Get role badge class for UI styling
 */
export function getRoleBadgeClass(role: UserRole): string {
  const color = ROLE_DEFINITIONS[role].color;
  return `bg-${color}-100 text-${color}-800 dark:bg-${color}-900 dark:text-${color}-200`;
}

/**
 * Get role icon class
 */
export function getRoleIcon(role: UserRole): string {
  return ROLE_DEFINITIONS[role].icon;
}

/**
 * Check if role requires MFA
 */
export function requiresMFA(role: UserRole): boolean {
  return ROLE_DEFINITIONS[role].requiresMFA;
}

/**
 * Get roles that require MFA
 */
export function getMFARequiredRoles(): UserRole[] {
  return getAllRoles()
    .filter(role => role.requiresMFA)
    .map(role => role.name);
}

/**
 * Validate role transition (for role changes)
 */
export function canTransitionToRole(fromRole: UserRole, toRole: UserRole, managerRole: UserRole): boolean {
  // Check if manager can manage both roles
  return canManageRole(managerRole, fromRole) && canManageRole(managerRole, toRole);
}

/**
 * Get role hierarchy for display purposes
 */
export function getRoleHierarchy(): RoleInfo[] {
  return getAllRoles().sort((a, b) => b.level - a.level);
}

/**
 * Get permissions unique to a role (not shared with lower roles)
 */
export function getUniquePermissions(role: UserRole): string[] {
  const rolePermissions = ROLE_DEFINITIONS[role].permissions;
  const lowerRoles = getAllRoles().filter(r => r.level < ROLE_DEFINITIONS[role].level);
  const lowerPermissions = new Set(lowerRoles.flatMap(r => r.permissions));

  return rolePermissions.filter(permission => !lowerPermissions.has(permission));
}

/**
 * Check if a role has management access
 */
export function hasManagementAccess(role: UserRole): boolean {
  return ['super_admin', 'owner', 'admin'].includes(role);
}

/**
 * Check if any of the roles has management access
 */
export function hasManagementAccessFromRoles(roles: string[]): boolean {
  return roles.some(role => hasManagementAccess(role as UserRole));
}
