import { Router } from 'express';
import * as alertController from '../controllers/alertController.js';
import { authenticateUser, requirePermission, requireAnyPermission } from '../middlewares/auth.js';

const router = Router();

// Alert routes with authentication
router.get('/', authenticateUser, requireAnyPermission(['read:inventory', 'read:products']), alertController.getAlerts);
router.get('/low-stock', authenticateUser, requireAnyPermission(['read:inventory', 'read:products']), alertController.getLowStockAlerts);
router.get('/expiry', authenticateUser, requireAnyPermission(['read:inventory', 'read:products']), alertController.getExpiryAlerts);
router.get('/stats', authenticateUser, requireAnyPermission(['read:inventory', 'read:products']), alertController.getAlertStats);
router.get('/:id', authenticateUser, requireAnyPermission(['read:inventory', 'read:products']), alertController.getAlertById);
router.post('/', authenticateUser, requirePermission('create:products'), alertController.createAlert);
router.put('/:id/acknowledge', authenticateUser, requireAnyPermission(['update:inventory', 'update:products']), alertController.acknowledgeAlert);
router.put('/:id/resolve', authenticateUser, requireAnyPermission(['update:inventory', 'update:products']), alertController.resolveAlert);
router.delete('/:id', authenticateUser, requirePermission('delete:products'), alertController.deleteAlert);

export default router;
