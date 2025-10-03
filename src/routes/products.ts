import { Router } from 'express';
import { authenticateUser, requirePermission, requireAnyPermission } from '../middlewares/auth.js';
import { createProduct, deleteProduct, getProductByBarcode, getProductById, getProducts, getProductStockHistory, updateProduct } from '../controllers/productController.js';

const router = Router();

// Product routes with authentication
router.post('/', authenticateUser, requirePermission('create:products'), createProduct);
router.get('/', authenticateUser, requireAnyPermission(['read:products', 'read:inventory']), getProducts);
router.get('/barcode/:barcode', authenticateUser, requireAnyPermission(['read:products', 'read:inventory']), getProductByBarcode);
router.get('/:id', authenticateUser, requireAnyPermission(['read:products', 'read:inventory']), getProductById);
router.get('/:id/stock-history', authenticateUser, requireAnyPermission(['read:products', 'read:inventory']), getProductStockHistory);
router.put('/:id', authenticateUser, requirePermission('update:products'), updateProduct);
router.delete('/:id', authenticateUser, requirePermission('delete:products'), deleteProduct);


export default router;
