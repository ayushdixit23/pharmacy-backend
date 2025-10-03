import { Router } from 'express';
import { authenticateUser, requireAnyPermission } from '../middlewares/auth.js';
import { getInventoryStock, getProductStock } from '../controllers/inventoryController.js';

const router = Router();

// Inventory stock routes with authentication
router.get('/stock', authenticateUser, requireAnyPermission(['read:inventory', 'read:products']), getInventoryStock);
router.get('/stock/:productId', authenticateUser, requireAnyPermission(['read:inventory', 'read:products']), getProductStock);

export default router;
