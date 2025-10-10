import { Request, Response } from 'express';
import { SalesService } from '../services/SalesService.js';
import asyncHandler from '../middlewares/tryCatch.js';
import { CustomError } from '../middlewares/errors/CustomError.js';
import { CreateSaleRequest, SaleWithDetails, CustomerData } from '../models/Sales.js';

const salesService = new SalesService();

export const createSale = asyncHandler(async (req: Request, res: Response) => {
  const {
    customer,
    items,
    notes,
    prescription_id,
    payment_method,
    discount_amount
  }: CreateSaleRequest = req.body;

  const cashierId = req.user?.id;
  if (!cashierId) {
    throw new CustomError('User not authenticated', 401);
  }

  // Validate required fields
  if (!items || items.length === 0) {
    throw new CustomError('Sale items are required', 400);
  }

  if (!payment_method) {
    throw new CustomError('Payment method is required', 400);
  }

  // Validate items
  for (const item of items) {
    if (!item.product_id || !item.quantity || item.quantity <= 0) {
      throw new CustomError('Invalid item data', 400);
    }
  }

  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');

  try {
    const sale = await salesService.createSale(
      {
        customer,
        items,
        notes,
        prescription_id,
        payment_method,
        discount_amount
      },
      cashierId,
      ipAddress,
      userAgent
    );

    console.log('Sale created successfully:', sale.id);

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: sale
    });
  } catch (error) {
    console.error('Error creating sale:', error);
    throw error;
  }
});

export const completeSale = asyncHandler(async (req: Request, res: Response) => {
  const { saleId } = req.params;
  const cashierId = req.user?.id;

  if (!cashierId) {
    throw new CustomError('User not authenticated', 401);
  }

  if (!saleId) {
    throw new CustomError('Sale ID is required', 400);
  }

  console.log('Completing sale with ID:', saleId);

  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');

  try {
    const sale = await salesService.completeSale(
      saleId,
      cashierId,
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: 'Sale completed successfully',
      data: sale
    });
  } catch (error) {
    console.error('Error completing sale:', error);
    throw error;
  }
});

export const cancelSale = asyncHandler(async (req: Request, res: Response) => {
  const { saleId } = req.params;
  const { reason } = req.body;
  const cashierId = req.user?.id;

  if (!cashierId) {
    throw new CustomError('User not authenticated', 401);
  }

  if (!saleId) {
    throw new CustomError('Sale ID is required', 400);
  }

  if (!reason) {
    throw new CustomError('Cancellation reason is required', 400);
  }

  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');

  const sale = await salesService.cancelSale(
    saleId,
    reason,
    cashierId,
    ipAddress,
    userAgent
  );

  res.json({
    success: true,
    message: 'Sale cancelled successfully',
    data: sale
  });
});

export const getSaleById = asyncHandler(async (req: Request, res: Response) => {
  const { saleId } = req.params;

  if (!saleId) {
    throw new CustomError('Sale ID is required', 400);
  }

  const sale = await salesService.getSaleById(saleId);

  if (!sale) {
    throw new CustomError('Sale not found', 404);
  }

  res.json({
    success: true,
    data: sale
  });
});

export const getSaleByNumber = asyncHandler(async (req: Request, res: Response) => {
  const { saleNumber } = req.params;

  if (!saleNumber) {
    throw new CustomError('Sale number is required', 400);
  }

  const sale = await salesService.getSaleByNumber(saleNumber);

  if (!sale) {
    throw new CustomError('Sale not found', 404);
  }

  res.json({
    success: true,
    data: sale
  });
});

export const listSales = asyncHandler(async (req: Request, res: Response) => {
  const {
    status,
    customer_id,
    cashier_id,
    start_date,
    end_date,
    limit = 50,
    offset = 0
  } = req.query;

  const filters = {
    status: status as string,
    customer_id: customer_id as string,
    cashier_id: cashier_id as string,
    start_date: start_date as string,
    end_date: end_date as string,
    limit: parseInt(limit as string),
    offset: parseInt(offset as string)
  };

  const sales = await salesService.listSales(filters);

  res.json({
    success: true,
    data: sales,
    pagination: {
      limit: filters.limit,
      offset: filters.offset,
      count: sales.length
    }
  });
});

export const getSalesStats = asyncHandler(async (req: Request, res: Response) => {
  const {
    start_date,
    end_date,
    cashier_id
  } = req.query;

  const filters = {
    start_date: start_date as string,
    end_date: end_date as string,
    cashier_id: cashier_id as string
  };

  const stats = await salesService.getSalesStats(filters);

  res.json({
    success: true,
    data: stats
  });
});

export const searchCustomers = asyncHandler(async (req: Request, res: Response) => {
  const { search, limit = 10 } = req.query;

  if (!search || typeof search !== 'string') {
    throw new CustomError('Search term is required', 400);
  }

  const customers = await salesService.searchCustomers(search, parseInt(limit as string));

  res.json({
    success: true,
    data: customers
  });
});

export const saveCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customerData: CustomerData = req.body;
  const createdBy = req.user?.id;

  if (!createdBy) {
    throw new CustomError('User not authenticated', 401);
  }

  // Validate required fields
  if (!customerData.patient_name || !customerData.patient_phone || !customerData.doctor_name) {
    throw new CustomError('Patient name, phone, and doctor name are required', 400);
  }

  const customer = await salesService.saveCustomer(customerData, createdBy);

  res.json({
    success: true,
    message: 'Customer saved successfully',
    data: customer
  });
});

export const getCustomerById = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;

  if (!customerId) {
    throw new CustomError('Customer ID is required', 400);
  }

  const customer = await salesService.getCustomerById(customerId);

  if (!customer) {
    throw new CustomError('Customer not found', 404);
  }

  res.json({
    success: true,
    data: customer
  });
});

export const getCustomerByPhone = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.params;

  if (!phone) {
    throw new CustomError('Phone number is required', 400);
  }

  const customer = await salesService.getCustomerByPhone(phone);

  if (!customer) {
    throw new CustomError('Customer not found', 404);
  }

  res.json({
    success: true,
    data: customer
  });
});

export const getRecentTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { limit = 10 } = req.query;

  const sales = await salesService.listSales({
    limit: parseInt(limit as string),
    offset: 0
  });

  // Transform to transaction format for UI
  const transactions = sales.map(sale => ({
    id: sale.sale_number,
    customer: sale.customer?.patient_name || 'Walk-in Customer',
    items: sale.items.length,
    amount: sale.total_amount,
    time: sale.created_at,
    status: sale.status
  }));

  res.json({
    success: true,
    data: transactions
  });
});
