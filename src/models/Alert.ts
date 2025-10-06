import db from '../db/knex.js';
import { v4 as uuidv4 } from 'uuid';

interface AlertData {
  product_id?: string;
  batch_id?: string;
  alert_type: 'LOW_STOCK' | 'EXPIRY_WARNING' | 'EXPIRED' | 'OUT_OF_STOCK';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  message: string;
  priority: number;
  user_id?: string;
}

interface AlertRecord {
  id: string;
  product_id?: string;
  batch_id?: string;
  alert_type: string;
  status: string;
  message: string;
  priority: number;
  user_id?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  product_name?: string;
  barcode?: string;
  batch_number?: string;
  expiry_date?: string;
  min_stock_level?: number;
  current_stock?: number;
}

interface AlertWithDetails extends AlertRecord {
  product_name: string;
  barcode?: string;
  batch_number?: string;
  expiry_date?: string;
}

interface LowStockAlert extends AlertRecord {
  product_name: string;
  barcode?: string;
  min_stock_level: number;
  current_stock: number;
}

interface ExpiryAlert extends AlertRecord {
  product_name: string;
  barcode?: string;
  batch_number: string;
  expiry_date: string;
}

class Alert {
  static async create(alertData: AlertData): Promise<AlertRecord> {
    const alertWithId = {
      id: uuidv4(),
      ...alertData
    };
    
    const [alert] = await db('alerts')
      .insert(alertWithId)
      .returning('*');
    return alert;
  }

  static async findById(id: string): Promise<AlertRecord | undefined> {
    return await db('alerts')
      .where({ id })
      .first();
  }

  static async findByUserId(userId: string, status: string = 'ACTIVE'): Promise<AlertWithDetails[]> {
    return await db('alerts as a')
      .select(
        'a.*',
        'p.name as product_name',
        'p.barcode',
        'b.batch_number',
        'b.expiry_date'
      )
      .join('products as p', 'a.product_id', 'p.id')
      .leftJoin('batches as b', 'a.batch_id', 'b.id')
      .where('a.status', status)
      .orderBy('a.priority', 'desc')
      .orderBy('a.created_at', 'desc');
  }

  static async findByProductId(productId: string): Promise<AlertRecord[]> {
    return await db('alerts')
      .where({ product_id: productId, status: 'ACTIVE' })
      .orderBy('priority', 'desc');
  }

  static async updateStatus(id: string, status: string, userId: string | null = null): Promise<AlertRecord> {
    const updateData: any = { 
      status, 
      updated_at: new Date() 
    };

    if (status === 'ACKNOWLEDGED') {
      updateData.acknowledged_at = new Date();
    } else if (status === 'RESOLVED') {
      updateData.resolved_at = new Date();
    }

    if (userId) {
      updateData.user_id = userId;
    }

    const [alert] = await db('alerts')
      .where({ id })
      .update(updateData)
      .returning('*');
    return alert;
  }

  static async delete(id: string): Promise<number> {
    return await db('alerts')
      .where({ id })
      .del();
  }

  static async getLowStockAlerts(): Promise<LowStockAlert[]> {
    return await db('alerts as a')
      .select(
        'a.*',
        'p.name as product_name',
        'p.barcode',
        'p.min_stock_level',
        'pb.current_stock'
      )
      .join('products as p', 'a.product_id', 'p.id')
      .leftJoin('product_branches as pb', function() {
        this.on('pb.product_id', '=', 'p.id')
          .andOn('pb.is_active', '=', db.raw('true'));
      })
      .where('a.alert_type', 'LOW_STOCK')
      .where('a.status', 'ACTIVE')
      .orderBy('a.priority', 'desc');
  }

  static async getExpiryAlerts(days: number = 30): Promise<ExpiryAlert[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    return await db('alerts as a')
      .select(
        'a.*',
        'p.name as product_name',
        'p.barcode',
        'b.batch_number',
        'b.expiry_date'
      )
      .join('products as p', 'a.product_id', 'p.id')
      .join('batches as b', 'a.batch_id', 'b.id')
      .where('a.alert_type', 'EXPIRY_WARNING')
      .where('a.status', 'ACTIVE')
      .where('b.expiry_date', '<=', expiryDate)
      .orderBy('b.expiry_date', 'asc');
  }

  static async createLowStockAlert(productId: string, currentStock: number, minStock: number): Promise<AlertRecord> {
    const existingAlert = await db('alerts')
      .where({ 
        product_id: productId, 
        alert_type: 'LOW_STOCK', 
        status: 'ACTIVE' 
      })
      .first();

    if (!existingAlert) {
      return await this.create({
        product_id: productId,
        alert_type: 'LOW_STOCK',
        status: 'ACTIVE',
        message: `Low stock alert: Current stock (${currentStock}) is below minimum level (${minStock})`,
        priority: currentStock === 0 ? 3 : 2
      });
    }
    return existingAlert;
  }

  static async createExpiryAlert(batchId: string, productId: string, expiryDate: Date, daysUntilExpiry: number): Promise<AlertRecord> {
    const alertType = daysUntilExpiry <= 0 ? 'EXPIRED' : 'EXPIRY_WARNING';
    const priority = daysUntilExpiry <= 0 ? 3 : (daysUntilExpiry <= 7 ? 2 : 1);

    const existingAlert = await db('alerts')
      .where({ 
        batch_id: batchId, 
        alert_type: alertType, 
        status: 'ACTIVE' 
      })
      .first();

    if (!existingAlert) {
      const message = daysUntilExpiry <= 0 
        ? `Product has expired on ${expiryDate.toDateString()}`
        : `Product expires in ${daysUntilExpiry} days (${expiryDate.toDateString()})`;

      return await this.create({
        batch_id: batchId,
        product_id: productId,
        alert_type: alertType,
        status: 'ACTIVE',
        message,
        priority
      });
    }
    return existingAlert;
  }
}

export default Alert;
