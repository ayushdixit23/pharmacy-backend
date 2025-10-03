import { Router } from 'express';
import * as barcodeController from '../controllers/barcodeController.js';
import { authenticateUser, requirePermission, requireAnyPermission } from '../middlewares/auth.js';

const router = Router();

// Barcode routes with authentication
router.get('/scan/:barcode', authenticateUser, requireAnyPermission(['read:products', 'read:inventory']), barcodeController.scanBarcode);
router.post('/scan/:barcode/update-stock', authenticateUser, requirePermission('update:inventory'), barcodeController.updateStockByBarcode);
router.post('/generate/:productId', authenticateUser, requirePermission('create:products'), barcodeController.generateBarcode);
router.post('/bulk-scan', authenticateUser, requireAnyPermission(['read:products', 'read:inventory']), barcodeController.bulkScanBarcodes);

export default router;
