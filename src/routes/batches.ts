import { Router } from 'express';
import * as batchController from '../controllers/batchController.js';
import { authenticateUser, requirePermission, requireAnyPermission } from '../middlewares/auth.js';

const router = Router();

// Batch routes with authentication
router.post('/', authenticateUser, requirePermission('create:products'), batchController.createBatch);
router.get('/product/:productId', authenticateUser, requireAnyPermission(['read:products', 'read:inventory']), batchController.getBatchesByProduct);
router.get('/expiring', authenticateUser, requireAnyPermission(['read:products', 'read:inventory']), batchController.getExpiringBatches);
router.get('/expired', authenticateUser, requireAnyPermission(['read:products', 'read:inventory']), batchController.getExpiredBatches);
router.get('/:id', authenticateUser, requireAnyPermission(['read:products', 'read:inventory']), batchController.getBatchById);
router.put('/:id', authenticateUser, requirePermission('update:products'), batchController.updateBatch);
router.put('/:id/quantity', authenticateUser, requirePermission('update:inventory'), batchController.updateBatchQuantity);
router.delete('/:id', authenticateUser, requirePermission('delete:products'), batchController.deleteBatch);

export default router;
