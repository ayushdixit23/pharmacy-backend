import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

export interface CustomerData {
  id?: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  doctor_name: string;
  doctor_license?: string;
  doctor_phone?: string;
  prescription_photo?: string;
  prescription_text?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SaleData {
  id?: string;
  sale_number?: string;
  customer_id?: string;
  cashier_id?: string;
  status?: 'DRAFT' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  prescription_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SaleItemData {
  id?: string;
  sale_id: string;
  product_id: string;
  batch_id?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount_amount?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentData {
  id?: string;
  sale_id: string;
  payment_method: 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'NET_BANKING' | 'CHEQUE';
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  amount: number;
  transaction_id?: string;
  payment_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SaleAuditLogData {
  id?: string;
  sale_id: string;
  action: string;
  description?: string;
  changes?: any;
  performed_by?: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSaleRequest {
  customer?: CustomerData;
  items: Array<{
    product_id: string;
    batch_id?: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
  }>;
  notes?: string;
  prescription_id?: string;
  payment_method: 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'NET_BANKING' | 'CHEQUE';
  discount_amount?: number;
}

export interface SaleWithDetails extends SaleData {
  customer?: CustomerData;
  items: Array<SaleItemData & {
    product?: {
      id: string;
      name: string;
      generic_name?: string;
      category: string;
      manufacturer?: string;
      unit_of_measure: string;
    };
    batch?: {
      id: string;
      batch_number: string;
      expiry_date?: string;
    };
  }>;
  payments: PaymentData[];
  cashier?: {
    id: string;
    name: string;
    email: string;
  };
}

export class CustomerModel {
  constructor(private db: Knex) {}

  async create(customerData: CustomerData): Promise<CustomerData> {
    const id = uuidv4();
    const [customer] = await this.db('customers')
      .insert({
        id,
        ...customerData,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return customer;
  }

  async findById(id: string): Promise<CustomerData | null> {
    const customer = await this.db('customers')
      .where({ id })
      .first();

    return customer || null;
  }

  async findByPhone(phone: string): Promise<CustomerData | null> {
    const customer = await this.db('customers')
      .where({ patient_phone: phone })
      .first();

    return customer || null;
  }

  async update(id: string, updates: Partial<CustomerData>): Promise<CustomerData | null> {
    const [customer] = await this.db('customers')
      .where({ id })
      .update({
        ...updates,
        updated_at: new Date()
      })
      .returning('*');

    return customer || null;
  }

  async search(searchTerm: string, limit: number = 10): Promise<CustomerData[]> {
    return this.db('customers')
      .where(function() {
        this.where('patient_name', 'ilike', `%${searchTerm}%`)
          .orWhere('patient_phone', 'ilike', `%${searchTerm}%`)
          .orWhere('patient_email', 'ilike', `%${searchTerm}%`)
          .orWhere('doctor_name', 'ilike', `%${searchTerm}%`);
      })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }
}

export class SalesModel {
  constructor(private db: Knex) {}

  async create(saleData: SaleData): Promise<SaleData> {
    const id = uuidv4();
    
    // Try to create sale with retry mechanism for sale number conflicts
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const saleNumber = await this.generateSaleNumber();
        console.log(`Attempt ${attempts + 1}: Creating sale with number:`, saleNumber);
        
        const insertData = {
          id,
          sale_number: saleNumber,
          ...saleData,
          created_at: new Date(),
          updated_at: new Date()
        };
        
        console.log('Inserting sale data:', JSON.stringify(insertData, null, 2));
        
        const [sale] = await this.db('sales')
          .insert(insertData)
          .returning('*');

        console.log('Database returned sale:', JSON.stringify(sale, null, 2));

        if (!sale || !sale.id) {
          throw new Error('Failed to create sale - no sale returned from database');
        }

        console.log('Sale created successfully in database:', sale.id);
        return sale;
      } catch (error: any) {
        attempts++;
        console.error(`Attempt ${attempts} failed:`, error.message);
        
        if (error.message.includes('duplicate key value violates unique constraint') && attempts < maxAttempts) {
          console.log('Sale number conflict detected, retrying...');
          // Wait a small amount before retrying to avoid race conditions
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error('Failed to create sale after maximum attempts');
  }

  async findById(id: string): Promise<SaleWithDetails | null> {
    const sale = await this.db('sales')
      .leftJoin('customers', 'sales.customer_id', 'customers.id')
      .leftJoin('user as cashier', 'sales.cashier_id', 'cashier.id')
      .select(
        'sales.id',
        'sales.sale_number',
        'sales.customer_id',
        'sales.cashier_id',
        'sales.status',
        'sales.subtotal',
        'sales.tax_amount',
        'sales.discount_amount',
        'sales.total_amount',
        'sales.notes',
        'sales.prescription_id',
        'sales.created_at',
        'sales.updated_at',
        'customers.id as customer_id',
        'customers.patient_name',
        'customers.patient_phone',
        'customers.patient_email',
        'customers.doctor_name',
        'customers.doctor_license',
        'customers.doctor_phone',
        'customers.prescription_photo',
        'customers.prescription_text',
        'customers.created_by',
        'customers.created_at as customer_created_at',
        'customers.updated_at as customer_updated_at',
        'cashier.id as cashier_id',
        'cashier.name as cashier_name',
        'cashier.email as cashier_email'
      )
      .where('sales.id', id)
      .first();

    if (!sale) return null;

    // Get sale items with product and batch details
    const items = await this.db('sale_items')
      .leftJoin('products', 'sale_items.product_id', 'products.id')
      .leftJoin('batches', 'sale_items.batch_id', 'batches.id')
      .select(
        'sale_items.*',
        'products.name as product_name',
        'products.generic_name as product_generic_name',
        'products.category as product_category',
        'products.manufacturer as product_manufacturer',
        'products.unit_of_measure as product_unit_of_measure',
        'batches.batch_number as batch_number',
        'batches.expiry_date as batch_expiry_date'
      )
      .where('sale_items.sale_id', id);

    // Get payments
    const payments = await this.db('payments')
      .where('sale_id', id);

    return {
      id: sale.id,
      sale_number: sale.sale_number,
      customer_id: sale.customer_id,
      cashier_id: sale.cashier_id,
      status: sale.status,
      subtotal: sale.subtotal,
      tax_amount: sale.tax_amount,
      discount_amount: sale.discount_amount,
      total_amount: sale.total_amount,
      notes: sale.notes,
      prescription_id: sale.prescription_id,
      created_at: sale.created_at,
      updated_at: sale.updated_at,
      customer: sale.customer_id ? {
        id: sale.customer_id,
        patient_name: sale.patient_name,
        patient_phone: sale.patient_phone,
        patient_email: sale.patient_email,
        doctor_name: sale.doctor_name,
        doctor_license: sale.doctor_license,
        doctor_phone: sale.doctor_phone,
        prescription_photo: sale.prescription_photo,
        prescription_text: sale.prescription_text,
        created_by: sale.created_by,
        created_at: sale.customer_created_at,
        updated_at: sale.customer_updated_at
      } : undefined,
      items: items.map(item => ({
        ...item,
        product: {
          id: item.product_id,
          name: item.product_name,
          generic_name: item.product_generic_name,
          category: item.product_category,
          manufacturer: item.product_manufacturer,
          unit_of_measure: item.product_unit_of_measure
        },
        batch: item.batch_id ? {
          id: item.batch_id,
          batch_number: item.batch_number,
          expiry_date: item.batch_expiry_date
        } : undefined
      })),
      payments,
      cashier: sale.cashier_id ? {
        id: sale.cashier_id,
        name: sale.cashier_name,
        email: sale.cashier_email
      } : undefined
    };
  }

  async findBySaleNumber(saleNumber: string): Promise<SaleWithDetails | null> {
    const sale = await this.db('sales')
      .where({ sale_number: saleNumber })
      .first();

    if (!sale) return null;

    return this.findById(sale.id);
  }

  async update(id: string, updates: Partial<SaleData>): Promise<SaleData | null> {
    const [sale] = await this.db('sales')
      .where({ id })
      .update({
        ...updates,
        updated_at: new Date()
      })
      .returning('*');

    return sale || null;
  }

  async updateStatus(id: string, status: SaleData['status']): Promise<SaleData | null> {
    return this.update(id, { status });
  }

  async list(filters: {
    status?: string;
    customer_id?: string;
    cashier_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<SaleWithDetails[]> {
    let query = this.db('sales')
      .leftJoin('customers', 'sales.customer_id', 'customers.id')
      .leftJoin('user as cashier', 'sales.cashier_id', 'cashier.id')
      .select(
        'sales.*',
        'customers.patient_name',
        'customers.patient_phone',
        'customers.patient_email',
        'cashier.name as cashier_name',
        'cashier.email as cashier_email'
      );

    if (filters.status) {
      query = query.where('sales.status', filters.status);
    }

    if (filters.customer_id) {
      query = query.where('sales.customer_id', filters.customer_id);
    }

    if (filters.cashier_id) {
      query = query.where('sales.cashier_id', filters.cashier_id);
    }

    if (filters.start_date) {
      query = query.where('sales.created_at', '>=', filters.start_date);
    }

    if (filters.end_date) {
      query = query.where('sales.created_at', '<=', filters.end_date);
    }

    const sales = await query
      .orderBy('sales.created_at', 'desc')
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    // Get items and payments for each sale
    const salesWithDetails = await Promise.all(
      sales.map(async (sale) => {
        const items = await this.db('sale_items')
          .leftJoin('products', 'sale_items.product_id', 'products.id')
          .leftJoin('batches', 'sale_items.batch_id', 'batches.id')
          .select(
            'sale_items.*',
            'products.name as product_name',
            'products.generic_name as product_generic_name',
            'products.category as product_category',
            'products.manufacturer as product_manufacturer',
            'products.unit_of_measure as product_unit_of_measure',
            'batches.batch_number as batch_number',
            'batches.expiry_date as batch_expiry_date'
          )
          .where('sale_items.sale_id', sale.id);

        const payments = await this.db('payments')
          .where('sale_id', sale.id);

        return {
          ...sale,
          customer: sale.customer_id ? {
            id: sale.customer_id,
            patient_name: sale.patient_name,
            patient_phone: sale.patient_phone,
            patient_email: sale.patient_email,
            doctor_name: sale.doctor_name,
            doctor_license: sale.doctor_license,
            doctor_phone: sale.doctor_phone,
            prescription_photo: sale.prescription_photo,
            prescription_text: sale.prescription_text,
            created_by: sale.created_by,
            created_at: sale.created_at,
            updated_at: sale.updated_at
          } : undefined,
          items: items.map(item => ({
            ...item,
            product: {
              id: item.product_id,
              name: item.product_name,
              generic_name: item.product_generic_name,
              category: item.product_category,
              manufacturer: item.product_manufacturer,
              unit_of_measure: item.product_unit_of_measure
            },
            batch: item.batch_id ? {
              id: item.batch_id,
              batch_number: item.batch_number,
              expiry_date: item.batch_expiry_date
            } : undefined
          })),
          payments,
          cashier: sale.cashier_id ? {
            id: sale.cashier_id,
            name: sale.cashier_name,
            email: sale.cashier_email
          } : undefined
        };
      })
    );

    return salesWithDetails;
  }

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
    let query = this.db('sales')
      .where('status', 'COMPLETED');

    if (filters.start_date) {
      query = query.where('created_at', '>=', filters.start_date);
    }

    if (filters.end_date) {
      query = query.where('created_at', '<=', filters.end_date);
    }

    if (filters.cashier_id) {
      query = query.where('cashier_id', filters.cashier_id);
    }

    const stats = await query
      .select(
        this.db.raw('COUNT(*) as total_transactions'),
        this.db.raw('COALESCE(SUM(total_amount), 0) as total_amount'),
        this.db.raw('COALESCE(AVG(total_amount), 0) as average_sale')
      )
      .first();

    return {
      total_sales: Number(stats.total_amount) || 0,
      total_amount: Number(stats.total_amount) || 0,
      total_transactions: Number(stats.total_transactions) || 0,
      average_sale: Number(stats.average_sale) || 0
    };
  }

  private async generateSaleNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const prefix = `SALE-${year}${month}${day}`;
    console.log('Generating sale number with prefix:', prefix);
    
    // Get the last sale number for today
    const lastSale = await this.db('sales')
      .where('sale_number', 'like', `${prefix}%`)
      .orderBy('sale_number', 'desc')
      .first();

    let sequence = 1;
    if (lastSale) {
      console.log('Last sale found:', lastSale.sale_number);
      // Extract sequence number from the last part of the sale number
      // Format: SALE-YYYYMMDD-NNNN
      const parts = lastSale.sale_number.split('-');
      console.log('Sale number parts:', parts);
      if (parts.length === 3) {
        const lastSequence = parseInt(parts[2]);
        console.log('Last sequence:', lastSequence);
        if (!isNaN(lastSequence)) {
          sequence = lastSequence + 1;
        }
      }
    } else {
      console.log('No previous sales found for today');
    }

    const saleNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;
    console.log('Generated sale number:', saleNumber);
    return saleNumber;
  }
}

export class SaleItemModel {
  constructor(private db: Knex) {}

  async create(itemData: SaleItemData): Promise<SaleItemData> {
    const id = uuidv4();
    const [item] = await this.db('sale_items')
      .insert({
        id,
        ...itemData,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return item;
  }

  async createMany(itemsData: SaleItemData[]): Promise<SaleItemData[]> {
    const items = itemsData.map(item => ({
      id: uuidv4(),
      ...item,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    await this.db('sale_items').insert(items);
    return items;
  }

  async findBySaleId(saleId: string): Promise<SaleItemData[]> {
    return this.db('sale_items')
      .where({ sale_id: saleId });
  }

  async deleteBySaleId(saleId: string): Promise<void> {
    await this.db('sale_items')
      .where({ sale_id: saleId })
      .del();
  }
}

export class PaymentModel {
  constructor(private db: Knex) {}

  async create(paymentData: PaymentData): Promise<PaymentData> {
    const id = uuidv4();
    const [payment] = await this.db('payments')
      .insert({
        id,
        ...paymentData,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return payment;
  }

  async findBySaleId(saleId: string): Promise<PaymentData[]> {
    return this.db('payments')
      .where({ sale_id: saleId });
  }

  async updateStatus(id: string, status: PaymentData['status']): Promise<PaymentData | null> {
    const [payment] = await this.db('payments')
      .where({ id })
      .update({
        status,
        updated_at: new Date()
      })
      .returning('*');

    return payment || null;
  }
}

export class SaleAuditLogModel {
  constructor(private db: Knex) {}

  async create(logData: SaleAuditLogData): Promise<SaleAuditLogData> {
    const id = uuidv4();
    const [log] = await this.db('sale_audit_logs')
      .insert({
        id,
        ...logData,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return log;
  }

  async findBySaleId(saleId: string): Promise<SaleAuditLogData[]> {
    return this.db('sale_audit_logs')
      .where({ sale_id: saleId })
      .orderBy('created_at', 'desc');
  }
}
