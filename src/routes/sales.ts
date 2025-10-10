import { Router } from 'express';
import { authenticateUser } from '../middlewares/auth.js';
import {
  createSale,
  completeSale,
  cancelSale,
  getSaleById,
  getSaleByNumber,
  listSales,
  getSalesStats,
  searchCustomers,
  saveCustomer,
  getCustomerById,
  getCustomerByPhone,
  getRecentTransactions
} from '../controllers/salesController.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Sale routes
router.post('/', createSale);
router.post('/:saleId/complete', completeSale);
router.post('/:saleId/cancel', cancelSale);
router.get('/:saleId', getSaleById);
router.get('/number/:saleNumber', getSaleByNumber);
router.get('/', listSales);
router.get('/stats/overview', getSalesStats);
router.get('/transactions/recent', getRecentTransactions);

// Customer routes
router.get('/customers/search', searchCustomers);
router.post('/customers', saveCustomer);
router.get('/customers/:customerId', getCustomerById);
router.get('/customers/phone/:phone', getCustomerByPhone);

export default router;