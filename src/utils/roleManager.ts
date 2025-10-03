import { UserRole, AuthenticatedUser, hasPermission, hasAnyPermission, getUserPermissions } from '../middlewares/auth.js';

// Role hierarchy (higher number = higher privilege)
export const ROLE_HIERARCHY = {
  [UserRole.PHARMACIST]: 1,
  [UserRole.ADMIN]: 2
};

// Check if user can manage another user's role
export const canManageUser = (currentUser: AuthenticatedUser, targetUser: AuthenticatedUser): boolean => {
  // Admin can manage pharmacists
  if (currentUser.role === UserRole.ADMIN) {
    return targetUser.role === UserRole.PHARMACIST;
  }

  // Pharmacists cannot manage other users
  return false;
};

// Check if user can access resource based on ownership
export const canAccessResource = (currentUser: AuthenticatedUser, resourceOwnerId: string): boolean => {
  // Pharmacists can access their own resources
  if (currentUser.role === UserRole.PHARMACIST) {
    return currentUser.id === resourceOwnerId;
  }

  // Admins can access all resources
  return true;
};

// Get accessible roles for a user to assign
export const getAssignableRoles = (currentUser: AuthenticatedUser): UserRole[] => {
  switch (currentUser.role) {
    case UserRole.ADMIN:
      return [UserRole.PHARMACIST];
    case UserRole.PHARMACIST:
    default:
      return [];
  }
};

// Check if role assignment is valid
export const isValidRoleAssignment = (currentUser: AuthenticatedUser, newRole: UserRole): boolean => {
  const assignableRoles = getAssignableRoles(currentUser);
  return assignableRoles.includes(newRole);
};

// Get role display name
export const getRoleDisplayName = (role: UserRole): string => {
  const displayNames = {
    [UserRole.PHARMACIST]: 'Pharmacist',
    [UserRole.ADMIN]: 'Administrator'
  };
  return displayNames[role];
};

// Get role description
export const getRoleDescription = (role: UserRole): string => {
  const descriptions = {
    [UserRole.PHARMACIST]: 'Can manage prescriptions, inventory, and create reports',
    [UserRole.ADMIN]: 'Full access to manage users, inventory, prescriptions, and system settings'
  };
  return descriptions[role];
};

// Check if user can perform action on resource
export const canPerformAction = (
  currentUser: AuthenticatedUser, 
  action: string, 
  resourceType: string,
  resourceOwnerId?: string
): boolean => {
  const permission = `${action}:${resourceType}`;
  
  // Check if user has the permission
  if (!hasPermission(currentUser, permission)) {
    return false;
  }

  // If resource has an owner, check if user can access it
  if (resourceOwnerId && !canAccessResource(currentUser, resourceOwnerId)) {
    return false;
  }

  return true;
};

// Get user's accessible features
export const getUserFeatures = (user: AuthenticatedUser): string[] => {
  const features = [];
  
  if (hasPermission(user, 'read:profile')) features.push('profile');
  if (hasPermission(user, 'read:prescriptions')) features.push('prescriptions');
  if (hasPermission(user, 'read:inventory')) features.push('inventory');
  if (hasPermission(user, 'read:reports')) features.push('reports');
  if (hasPermission(user, 'read:users')) features.push('user-management');
  if (hasPermission(user, 'read:suppliers')) features.push('supplier-management');
  
  return features;
};

// Validate user role transition
export const validateRoleTransition = (
  currentUser: AuthenticatedUser,
  targetUser: AuthenticatedUser,
  newRole: UserRole
): { valid: boolean; reason?: string } => {
  // Check if current user can manage the target user
  if (!canManageUser(currentUser, targetUser)) {
    return {
      valid: false,
      reason: 'You do not have permission to manage this user'
    };
  }

  // Check if the new role is assignable
  if (!isValidRoleAssignment(currentUser, newRole)) {
    return {
      valid: false,
      reason: 'You cannot assign this role'
    };
  }

  // Check if trying to assign a higher role than current user
  if (ROLE_HIERARCHY[newRole] > ROLE_HIERARCHY[currentUser.role]) {
    return {
      valid: false,
      reason: 'You cannot assign a role higher than your own'
    };
  }

  return { valid: true };
};
