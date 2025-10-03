import { Router } from 'express';
import { authenticateUser, requireRole, requirePermission, UserRole } from '../middlewares/auth.js';
import { 
  canManageUser, 
  getAssignableRoles, 
  validateRoleTransition,
  getRoleDisplayName,
  getRoleDescription,
  getUserFeatures
} from '../utils/roleManager.js';

const router = Router();

// Get all users (admin only)
router.get('/', 
  authenticateUser, 
  requireRole([UserRole.ADMIN]), 
  async (req, res) => {
    try {
      // In a real application, you would fetch users from database
      const users = [
        {
          id: '1',
          email: 'admin@pharmacy.com',
          name: 'Admin User',
          role: UserRole.ADMIN,
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          email: 'pharmacist@pharmacy.com',
          name: 'Pharmacist User',
          role: UserRole.PHARMACIST,
          createdAt: new Date().toISOString()
        }
      ];

      res.json({
        success: true,
        users,
        total: users.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users'
      });
    }
  }
);

// Get user by ID
router.get('/:userId', 
  authenticateUser, 
  requirePermission('read:users'), 
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      // In a real application, fetch user from database
      const user = {
        id: userId,
        email: 'pharmacist@pharmacy.com',
        name: 'Pharmacist Name',
        role: UserRole.PHARMACIST,
        phoneNumber: '+1234567890',
        pharmacyName: 'Test Pharmacy',
        drugLicenseNumber: 'DL123456'
      };

      res.json({
        success: true,
        user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user'
      });
    }
  }
);

// Update user role
router.put('/:userId/role', 
  authenticateUser, 
  requirePermission('update:users'), 
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      // Validate role
      if (!Object.values(UserRole).includes(role)) {
        res.status(400).json({
          success: false,
          error: 'Invalid role'
        });
        return;
      }

      // Check if current user can manage this user
      const targetUser = {
        id: userId,
        email: 'target@example.com', // In real app, fetch from database
        name: 'Target User',
        role: UserRole.PHARMACIST // In real app, fetch from database
      };

      const validation = validateRoleTransition(req.user!, targetUser, role);
      if (!validation.valid) {
        res.status(403).json({
          success: false,
          error: validation.reason
        });
        return;
      }

      // In a real application, update user role in database
      res.json({
        success: true,
        message: 'User role updated successfully',
        user: {
          id: userId,
          role: role
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update user role'
      });
    }
  }
);

// Get assignable roles for current user
router.get('/roles/assignable', 
  authenticateUser, 
  requirePermission('read:users'), 
  (req, res) => {
    try {
      const assignableRoles = getAssignableRoles(req.user!);
      
      const rolesWithInfo = assignableRoles.map(role => ({
        role,
        displayName: getRoleDisplayName(role),
        description: getRoleDescription(role)
      }));

      res.json({
        success: true,
        roles: rolesWithInfo
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assignable roles'
      });
    }
  }
);

// Get current user's permissions and features
router.get('/me/permissions', 
  authenticateUser, 
  (req, res) => {
    try {
      const features = getUserFeatures(req.user!);
      
      res.json({
        success: true,
        user: req.user,
        features,
        permissions: req.user!.role // In real app, get actual permissions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user permissions'
      });
    }
  }
);

// Check if user can manage another user
router.get('/:userId/can-manage', 
  authenticateUser, 
  requirePermission('read:users'), 
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      // In a real application, fetch target user from database
      const targetUser = {
        id: userId,
        email: 'target@pharmacy.com',
        name: 'Target User',
        role: UserRole.PHARMACIST
      };

      const canManage = canManageUser(req.user!, targetUser);
      const assignableRoles = canManage ? getAssignableRoles(req.user!) : [];

      res.json({
        success: true,
        canManage,
        assignableRoles: assignableRoles.map(role => ({
          role,
          displayName: getRoleDisplayName(role),
          description: getRoleDescription(role)
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to check user management permissions'
      });
    }
  }
);

// Delete user (admin only)
router.delete('/:userId', 
  authenticateUser, 
  requireRole([UserRole.ADMIN]), 
  async (req, res) => {
    try {
      const { userId } = req.params;

      // In a real application, delete user from database
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete user'
      });
    }
  }
);

export default router;
