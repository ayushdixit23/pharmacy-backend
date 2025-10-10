import db from '../db/knex.js';
import { v4 as uuidv4 } from 'uuid';
import { 
  SalesModel, 
  CustomerModel, 
  SaleItemModel, 
  PaymentModel, 
  SaleAuditLogModel,
  CreateSaleRequest,
  SaleWithDetails,
  CustomerData,
  SaleData,
  PaymentData
} from '../models/Sales.js';
import { StockManagementService } from './StockManagementService.js';
import Product from '../models/Product.js';
import Batch from '../models/Batch.js';

export class SalesService {
  private salesModel: SalesModel;
  private customerModel: CustomerModel;
  private saleItemModel: SaleItemModel;
  private paymentModel: PaymentModel;
  private auditLogModel: SaleAuditLogModel;

  constructor() {
    this.salesModel = new SalesModel(db);
    this.customerModel = new CustomerModel(db);
    this.saleItemModel = new SaleItemModel(db);
    this.paymentModel = new PaymentModel(db);
    this.auditLogModel = new SaleAuditLogModel(db);
  }

  /**
   * Create a new sale with customer, items, and payment
   */
  async createSale(
    saleRequest: CreateSaleRequest, 
    cashierId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SaleWithDetails> {
    const transaction = await db.transaction();

    try {
      let customer: CustomerData | null = null;

      // Create or find customer
      if (saleRequest.customer) {
        console.log('Customer data received:', saleRequest.customer);
        
        // First try to find by ID if provided (for existing customers)
        if (saleRequest.customer.id) {
          customer = await this.customerModel.findById(saleRequest.customer.id);
        }
        
        // If not found by ID, try to find by phone
        if (!customer) {
          customer = await this.customerModel.findByPhone(saleRequest.customer.patient_phone);
        }
        
        // If still not found, create new customer (backend will generate ID)
        if (!customer) {
          console.log('Creating new customer...');
          customer = await this.customerModel.create({
            ...saleRequest.customer,
            created_by: cashierId
          });
          console.log('Customer created successfully with ID:', customer.id);
        }
      } else {
        console.log('No customer data provided');
      }

      // Validate products and calculate totals (without stock check)
      const validatedItems = await this.validateSaleItemsWithoutStockCheck(saleRequest.items);
      const totals = this.calculateTotals(validatedItems, saleRequest.discount_amount || 0);

      // Create sale record
      const saleData: SaleData = {
        customer_id: customer?.id,
        cashier_id: cashierId,
        status: 'PENDING',
        subtotal: totals.subtotal,
        tax_amount: totals.tax,
        discount_amount: totals.discount,
        total_amount: totals.total,
        notes: saleRequest.notes,
        prescription_id: saleRequest.prescription_id
      };
      
      console.log('Sale data with customer ID:', saleData.customer_id);

      const sale = await this.salesModel.create(saleData);
      console.log('Sale created with ID:', sale.id);
      console.log('Full sale object:', JSON.stringify(sale, null, 2));

      // Create sale items
      const saleItems = validatedItems.map(item => ({
        sale_id: sale.id!,
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price - (item.discount_amount || 0),
        discount_amount: item.discount_amount || 0
      }));

      await this.saleItemModel.createMany(saleItems);
      console.log('Sale items created for sale:', sale.id);

      // Create payment record
      const paymentData: PaymentData = {
        sale_id: sale.id!,
        payment_method: saleRequest.payment_method,
        status: 'PENDING',
        amount: totals.total
      };

      await this.paymentModel.create(paymentData);
      console.log('Payment record created for sale:', sale.id);

      // Create audit log
      await this.auditLogModel.create({
        sale_id: sale.id!,
        action: 'CREATED',
        description: 'Sale created',
        performed_by: cashierId,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      await transaction.commit();
      console.log('Transaction committed for sale:', sale.id);

      // Return complete sale details
      const saleWithDetails = await this.salesModel.findById(sale.id!);
      if (!saleWithDetails) {
        throw new Error('Failed to retrieve created sale');
      }

      console.log('Sale with details retrieved:', saleWithDetails.id);
      return saleWithDetails;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Complete a sale (process payment and update stock)
   */
  async completeSale(
    saleId: string, 
    cashierId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SaleWithDetails> {
    const transaction = await db.transaction();

    try {
      // Get sale details
      console.log('Looking for sale with ID:', saleId);
      const sale = await this.salesModel.findById(saleId);
      if (!sale) {
        console.error('Sale not found with ID:', saleId);
        throw new Error('Sale not found');
      }

      console.log('Sale found:', sale.id, 'Status:', sale.status);
      if (sale.status !== 'PENDING') {
        throw new Error('Sale is not in pending status');
      }

      // Update stock for each item
      for (const item of sale.items) {
        console.log('Processing stock operation for item:', {
          productId: item.product_id,
          batchId: item.batch_id,
          quantity: item.quantity,
          productName: item.product?.name
        });
        
        try {
          await StockManagementService.executeStockOperation({
            productId: item.product_id,
            batchId: item.batch_id,
            quantity: item.quantity,
            operationType: 'SALE',
            reason: `Sale ${sale.sale_number}`,
            userId: cashierId,
            referenceId: saleId
          });
          console.log('Stock operation completed successfully for product:', item.product?.name);
        } catch (error) {
          console.error('Stock operation failed for product:', item.product?.name, error);
          throw error;
        }
      }

      // Update sale status
      await this.salesModel.updateStatus(saleId, 'COMPLETED');

      // Update payment status
      const payments = await this.paymentModel.findBySaleId(saleId);
      for (const payment of payments) {
        await this.paymentModel.updateStatus(payment.id!, 'COMPLETED');
      }

      // Create audit log
      await this.auditLogModel.create({
        sale_id: saleId,
        action: 'COMPLETED',
        description: 'Sale completed and stock updated',
        performed_by: cashierId,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      await transaction.commit();

      // Return updated sale details
      const updatedSale = await this.salesModel.findById(saleId);
      if (!updatedSale) {
        throw new Error('Failed to retrieve updated sale');
      }

      return updatedSale;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Cancel a sale
   */
  async cancelSale(
    saleId: string, 
    reason: string,
    cashierId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SaleWithDetails> {
    const transaction = await db.transaction();

    try {
      // Get sale details
      const sale = await this.salesModel.findById(saleId);
      if (!sale) {
        throw new Error('Sale not found');
      }

      if (sale.status === 'COMPLETED') {
        throw new Error('Cannot cancel completed sale');
      }

      // Update sale status
      await this.salesModel.updateStatus(saleId, 'CANCELLED');

      // Update payment status
      const payments = await this.paymentModel.findBySaleId(saleId);
      for (const payment of payments) {
        await this.paymentModel.updateStatus(payment.id!, 'FAILED');
      }

      // Create audit log
      await this.auditLogModel.create({
        sale_id: saleId,
        action: 'CANCELLED',
        description: `Sale cancelled: ${reason}`,
        performed_by: cashierId,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      await transaction.commit();

      // Return updated sale details
      const updatedSale = await this.salesModel.findById(saleId);
      if (!updatedSale) {
        throw new Error('Failed to retrieve updated sale');
      }

      return updatedSale;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get sale by ID
   */
  async getSaleById(saleId: string): Promise<SaleWithDetails | null> {
    return this.salesModel.findById(saleId);
  }

  /**
   * Get sale by sale number
   */
  async getSaleByNumber(saleNumber: string): Promise<SaleWithDetails | null> {
    return this.salesModel.findBySaleNumber(saleNumber);
  }

  /**
   * List sales with filters
   */
  async listSales(filters: {
    status?: string;
    customer_id?: string;
    cashier_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<SaleWithDetails[]> {
    return this.salesModel.list(filters);
  }

  /**
   * Get sales statistics
   */
  async getSalesStats(filters: {
    start_date?: string;
    end_date?: string;
    cashier_id?: string;
  } = {}): Promise<{
    total_sales: number;
    total_amount: number;
    total_transactions: number;
    average_sale: number;
  }> {
    return this.salesModel.getSalesStats(filters);
  }

  /**
   * Search customers
   */
  async searchCustomers(searchTerm: string, limit: number = 10): Promise<CustomerData[]> {
    return this.customerModel.search(searchTerm, limit);
  }

  /**
   * Create or update customer
   */
  async saveCustomer(customerData: CustomerData, createdBy: string): Promise<CustomerData> {
    if (customerData.id) {
      const updated = await this.customerModel.update(customerData.id, customerData);
      if (!updated) {
        throw new Error('Customer not found');
      }
      return updated;
    } else {
      return this.customerModel.create({
        ...customerData,
        created_by: createdBy
      });
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<CustomerData | null> {
    return this.customerModel.findById(customerId);
  }

  /**
   * Get customer by phone
   */
  async getCustomerByPhone(phone: string): Promise<CustomerData | null> {
    return this.customerModel.findByPhone(phone);
  }

  /**
   * Validate sale items and get current prices
   */
  private async validateSaleItems(items: CreateSaleRequest['items']): Promise<Array<{
    product_id: string;
    batch_id?: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
  }>> {
    const validatedItems = [];

    for (const item of items) {
      // Get product details
      const product = await Product.findById(item.product_id);
      if (!product) {
        throw new Error(`Product not found: ${item.product_id}`);
      }

      if (!product.is_active) {
        throw new Error(`Product is not active: ${product.name}`);
      }

      // Check stock availability
      const stockSummary = await StockManagementService.getStockSummary(item.product_id);
      if (stockSummary.total_quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${stockSummary.total_quantity}, Required: ${item.quantity}`);
      }

      // Validate batch if provided
      let batchId = item.batch_id;
      if (batchId) {
        const batch = await Batch.findById(batchId);
        if (!batch || batch.product_id !== item.product_id) {
          throw new Error(`Invalid batch for product ${product.name}`);
        }
      }

      // Use current selling price
      const unitPrice = product.selling_price || product.unit_price || 0;
      if (unitPrice <= 0) {
        throw new Error(`Invalid price for product ${product.name}`);
      }

      validatedItems.push({
        product_id: item.product_id,
        batch_id: batchId,
        quantity: item.quantity,
        unit_price: unitPrice,
        discount_amount: item.discount_amount
      });
    }

    return validatedItems;
  }

  /**
   * Validate sale items and get current prices (without stock check)
   */
  private async validateSaleItemsWithoutStockCheck(items: CreateSaleRequest['items']): Promise<Array<{
    product_id: string;
    batch_id?: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
  }>> {
    const validatedItems = [];

    for (const item of items) {
      // Get product details
      const product = await Product.findById(item.product_id);
      if (!product) {
        throw new Error(`Product not found: ${item.product_id}`);
      }

      if (!product.is_active) {
        throw new Error(`Product is not active: ${product.name}`);
      }

      // Validate batch if provided
      let batchId = item.batch_id;
      if (batchId) {
        const batch = await Batch.findById(batchId);
        if (!batch || batch.product_id !== item.product_id) {
          throw new Error(`Invalid batch for product ${product.name}`);
        }
      }

      // Use current selling price
      const unitPrice = product.selling_price || product.unit_price || 0;
      if (unitPrice <= 0) {
        throw new Error(`Invalid price for product ${product.name}`);
      }

      validatedItems.push({
        product_id: item.product_id,
        batch_id: batchId,
        quantity: item.quantity,
        unit_price: unitPrice,
        discount_amount: item.discount_amount
      });
    }

    return validatedItems;
  }

  /**
   * Calculate sale totals
   */
  private calculateTotals(
    items: Array<{
      quantity: number;
      unit_price: number;
      discount_amount?: number;
    }>,
    discountAmount: number = 0
  ): {
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
  } {
    const subtotal = items.reduce((sum, item) => {
      const itemTotal = (item.quantity * item.unit_price) - (item.discount_amount || 0);
      return sum + itemTotal;
    }, 0);

    const discount = discountAmount;
    const taxableAmount = subtotal - discount;
    const tax = taxableAmount * 0.12; // 12% GST
    const total = taxableAmount + tax;

    return {
      subtotal,
      tax,
      discount,
      total
    };
  }
}
