import { Router } from 'express';
import * as supplierController from '../controllers/supplierController.js';
import { authenticateUser, requirePermission, requireAnyPermission } from '../middlewares/auth.js';

const router = Router();

// Supplier routes with authentication
router.post('/', authenticateUser, requirePermission('create:suppliers'), supplierController.createSupplier);
router.get('/', authenticateUser, requireAnyPermission(['read:suppliers', 'read:inventory']), supplierController.getSuppliers);
router.get('/:id', authenticateUser, requireAnyPermission(['read:suppliers', 'read:inventory']), supplierController.getSupplierById);
router.get('/:id/products', authenticateUser, requireAnyPermission(['read:suppliers', 'read:products']), supplierController.getSupplierProducts);
router.get('/:id/stats', authenticateUser, requireAnyPermission(['read:suppliers', 'read:inventory']), supplierController.getSupplierStats);
router.put('/:id', authenticateUser, requirePermission('update:suppliers'), supplierController.updateSupplier);
router.delete('/:id', authenticateUser, requirePermission('delete:suppliers'), supplierController.deleteSupplier);

export default router;
