import { Router, Response } from 'express';
import { authenticateUser } from '../middlewares/auth.js';
import StockManagementService from '../services/StockManagementService.js';
import tryCatch from '../middlewares/tryCatch.js';
import { AuthenticatedRequest } from '../types.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateUser);

/**
 * Get stock summary for a product
 */
router.get('/summary/:productId', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;
  
  const stockSummary = await StockManagementService.getStockSummary(productId);
  
  res.json({
    success: true,
    data: stockSummary
  });
}));

/**
 * Get available stock for a product
 */
router.get('/available/:productId', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;
  const { branchId } = req.query;
  
  const availableStock = await StockManagementService.getAvailableStock(
    productId, 
    branchId as string
  );
  
  res.json({
    success: true,
    data: { availableStock }
  });
}));

/**
 * Validate stock availability
 */
router.post('/validate', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const { productId, quantity, batchId } = req.body;
  
  const validation = await StockManagementService.validateStockAvailability(
    productId,
    quantity,
    batchId
  );
  
  res.json({
    success: true,
    data: validation
  });
}));

/**
 * Reserve stock
 */
router.post('/reserve', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const { productId, batchId, quantity, reservationType, referenceId, expiresAt } = req.body;
  
  const reservation = await StockManagementService.reserveStock({
    productId,
    batchId,
    quantity,
    reservationType,
    referenceId,
    expiresAt: new Date(expiresAt),
    userId: req.user?.id
  });
  
  res.json({
    success: true,
    data: { reservationId: reservation }
  });
}));

/**
 * Execute stock operation
 */
router.post('/execute', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const { productId, batchId, quantity, operationType, reason, referenceId } = req.body;
  
  const operationId = await StockManagementService.executeStockOperation({
    productId,
    batchId,
    quantity,
    operationType,
    reason,
    userId: req.user?.id,
    referenceId
  });
  
  res.json({
    success: true,
    data: { operationId }
  });
}));

/**
 * Release stock reservation
 */
router.delete('/reserve/:reservationId', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const { reservationId } = req.params;
  
  await StockManagementService.releaseStockReservation(reservationId);
  
  res.json({
    success: true,
    message: 'Stock reservation released successfully'
  });
}));

/**
 * Get FIFO batches for a product
 */
router.get('/fifo/:productId', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;
  const { quantity } = req.query;
  
  const batches = await StockManagementService.getFIFOBatches(
    productId, 
    parseInt(quantity as string)
  );
  
  res.json({
    success: true,
    data: batches
  });
}));

/**
 * Get stock movement history
 */
router.get('/history', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const { productId, batchId, movementType, dateFrom, dateTo, limit } = req.query;
  
  const history = await StockManagementService.getStockHistory({
    productId: productId as string,
    batchId: batchId as string,
    movementType: movementType as string,
    dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
    dateTo: dateTo ? new Date(dateTo as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined
  });
  
  res.json({
    success: true,
    data: history
  });
}));

/**
 * Get expiring batches
 */
router.get('/expiring', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const { days = 30 } = req.query;
  
  const expiringBatches = await StockManagementService.getExpiringBatches(
    parseInt(days as string)
  );
  
  res.json({
    success: true,
    data: expiringBatches
  });
}));

/**
 * Get low stock products
 */
router.get('/low-stock', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const lowStockProducts = await StockManagementService.getLowStockProducts();
  
  res.json({
    success: true,
    data: lowStockProducts
  });
}));

/**
 * Get batch details
 */
router.get('/batch/:batchId', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const { batchId } = req.params;
  
  const batchDetails = await StockManagementService.getBatchDetails(batchId);
  
  res.json({
    success: true,
    data: batchDetails
  });
}));

/**
 * Clean up expired reservations (admin endpoint)
 */
router.post('/cleanup', tryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const cleanedCount = await StockManagementService.cleanupExpiredReservations();
  
  res.json({
    success: true,
    data: { cleanedCount },
    message: `Cleaned up ${cleanedCount} expired reservations`
  });
}));

export default router;
