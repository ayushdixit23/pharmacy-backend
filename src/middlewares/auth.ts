import { Request, Response, NextFunction } from 'express';
import { auth } from '../auth.js';
import { fromNodeHeaders } from 'better-auth/node';

// Define user roles
export enum UserRole {
  PHARMACIST = 'PHARMACIST',
  ADMIN = 'ADMIN'
}

// Define permissions for each role
export const ROLE_PERMISSIONS = {
  [UserRole.PHARMACIST]: [
    'read:profile',
    'update:profile',
    'read:prescriptions',
    'create:prescriptions',
    'update:prescriptions',
    'read:inventory',
    'update:inventory',
    'create:products',
    'update:products',
    'read:reports',
    'create:reports'
  ],
  [UserRole.ADMIN]: [
    'read:profile',
    'update:profile',
    'read:prescriptions',
    'create:prescriptions',
    'update:prescriptions',
    'delete:prescriptions',
    'read:inventory',
    'update:inventory',
    'create:products',
    'update:products',
    'delete:products',
    'read:reports',
    'create:reports',
    'update:reports',
    'delete:reports',
    'read:users',
    'create:users',
    'update:users',
    'read:suppliers',
    'create:suppliers',
    'update:suppliers',
    'delete:suppliers'
  ]
};

// Interface for authenticated user
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phoneNumber?: string;
  pharmacyName?: string;
  drugLicenseNumber?: string;
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Middleware to authenticate user and attach to request
export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  console.log("authenticateUser");
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
      return;
    }

    // Attach user to request object
    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as UserRole,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid authentication' 
    });
  }
};

// Middleware to check if user has required role
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        error: 'Forbidden', 
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}` 
      });
      return;
    }

    next();
  };
};

// Middleware to check if user has required permission
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
      return;
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role];

    if (!userPermissions.includes(permission)) {
      res.status(403).json({ 
        error: 'Forbidden', 
        message: `Access denied. Required permission: ${permission}` 
      });
      return;
    }

    next();
  };
};

// Middleware to check if user has any of the required permissions
export const requireAnyPermission = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
      return;
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role];

    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      res.status(403).json({ 
        error: 'Forbidden', 
        message: `Access denied. Required permissions: ${permissions.join(' OR ')}` 
      });
      return;
    }

    next();
  };
};

// Utility function to check if user has permission
export const hasPermission = (user: AuthenticatedUser, permission: string): boolean => {
  const userPermissions = ROLE_PERMISSIONS[user.role];
  return userPermissions.includes(permission);
};

// Utility function to check if user has any of the permissions
export const hasAnyPermission = (user: AuthenticatedUser, permissions: string[]): boolean => {
  const userPermissions = ROLE_PERMISSIONS[user.role];
  return permissions.some(permission => userPermissions.includes(permission));
};

// Utility function to get user permissions
export const getUserPermissions = (user: AuthenticatedUser): string[] => {
  return ROLE_PERMISSIONS[user.role];
};
