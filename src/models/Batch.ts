import db from '../db/knex.js';

interface BatchData {
  id: string;
  batch_number: string;
  product_id: string;
  supplier_id: string;
  manufacturing_date: Date;
  expiry_date: Date;
  initial_quantity: number;
  current_quantity: number;
  cost_price: number;
  is_active?: boolean;
}

interface BatchRecord {
  id: string;
  batch_number: string;
  product_id: string;
  supplier_id: string;
  manufacturing_date: string;
  expiry_date: string;
  initial_quantity: number;
  current_quantity: number;
  cost_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BatchWithDetails extends BatchRecord {
  product_name: string;
  barcode?: string;
  supplier_name: string;
}

class Batch {
  static async create(batchData: BatchData): Promise<BatchRecord> {
    const [batch] = await db('batches')
      .insert(batchData)
      .returning('*');
    return batch;
  }

  static async findById(id: string): Promise<BatchRecord | undefined> {
    return await db('batches')
      .where({ id })
      .first();
  }

  static async findByProductId(productId: string): Promise<BatchRecord[]> {
    return await db('batches')
      .where({ product_id: productId, is_active: true })
      .orderBy('expiry_date', 'asc');
  }

  static async findByBatchNumber(productId: string, batchNumber: string): Promise<BatchRecord | undefined> {
    return await db('batches')
      .where({ product_id: productId, batch_number: batchNumber })
      .first();
  }

  static async update(id: string, updateData: Partial<BatchData>): Promise<BatchRecord> {
    const [batch] = await db('batches')
      .where({ id })
      .update({ ...updateData, updated_at: new Date() })
      .returning('*');
    return batch;
  }

  static async delete(id: string): Promise<number> {
    return await db('batches')
      .where({ id })
      .update({ is_active: false, updated_at: new Date() });
  }

  static async getExpiringBatches(days: number = 30): Promise<BatchWithDetails[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    return await db('batches as b')
      .select(
        'b.*',
        'p.name as product_name',
        'p.barcode',
        's.name as supplier_name'
      )
      .join('products as p', 'b.product_id', 'p.id')
      .leftJoin('suppliers as s', 'b.supplier_id', 's.id')
      .where('b.is_active', true)
      .where('b.current_quantity', '>', 0)
      .where('b.expiry_date', '<=', expiryDate)
      .orderBy('b.expiry_date', 'asc');
  }

  static async getExpiredBatches(): Promise<BatchWithDetails[]> {
    return await db('batches as b')
      .select(
        'b.*',
        'p.name as product_name',
        'p.barcode',
        's.name as supplier_name'
      )
      .join('products as p', 'b.product_id', 'p.id')
      .leftJoin('suppliers as s', 'b.supplier_id', 's.id')
      .where('b.is_active', true)
      .where('b.current_quantity', '>', 0)
      .where('b.expiry_date', '<', new Date())
      .orderBy('b.expiry_date', 'asc');
  }

  static async updateQuantity(id: string, newQuantity: number): Promise<number> {
    return await db('batches')
      .where({ id })
      .update({ 
        current_quantity: newQuantity,
        updated_at: new Date()
      });
  }
}

export default Batch;
