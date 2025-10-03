import db from '../db/knex.js';

interface StockMovementData {
  product_id: string;
  batch_id?: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  reason?: string;
  user_id?: string;
  reference_id?: string;
  reference_type?: string;
}

interface StockMovementFilters {
  product_id?: string;
  movement_type?: string;
  date_from?: string;
  date_to?: string;
  user_id?: string;
  limit?: number;
}

interface StockMovementRecord {
  id: string;
  product_id: string;
  batch_id?: string;
  movement_type: string;
  quantity: number;
  reason?: string;
  user_id?: string;
  reference_id?: string;
  reference_type?: string;
  created_at: string;
  updated_at: string;
  product_name?: string;
  batch_number?: string;
  user_name?: string;
  barcode?: string;
  expiry_date?: string;
}

interface StockSummary {
  [key: string]: number;
}

class StockMovement {
  static async create(movementData: StockMovementData): Promise<StockMovementRecord> {
    const [movement] = await db('stock_movements')
      .insert(movementData)
      .returning('*');
    return movement;
  }

  static async findByProductId(productId: string, limit: number = 50): Promise<StockMovementRecord[]> {
    return await db('stock_movements as sm')
      .select(
        'sm.*',
        'p.name as product_name',
        'b.batch_number',
        'u.name as user_name'
      )
      .join('products as p', 'sm.product_id', 'p.id')
      .leftJoin('batches as b', 'sm.batch_id', 'b.id')
      .leftJoin('user as u', 'sm.user_id', 'u.id')
      .where('sm.product_id', productId)
      .orderBy('sm.created_at', 'desc')
      .limit(limit);
  }

  static async findByBatchId(batchId: string, limit: number = 50): Promise<StockMovementRecord[]> {
    return await db('stock_movements as sm')
      .select(
        'sm.*',
        'p.name as product_name',
        'b.batch_number',
        'u.name as user_name'
      )
      .join('products as p', 'sm.product_id', 'p.id')
      .join('batches as b', 'sm.batch_id', 'b.id')
      .leftJoin('user as u', 'sm.user_id', 'u.id')
      .where('sm.batch_id', batchId)
      .orderBy('sm.created_at', 'desc')
      .limit(limit);
  }

  static async getMovementHistory(filters: StockMovementFilters = {}): Promise<StockMovementRecord[]> {
    let query = db('stock_movements as sm')
      .select(
        'sm.*',
        'p.name as product_name',
        'p.barcode',
        'b.batch_number',
        'b.expiry_date',
        'u.name as user_name'
      )
      .join('products as p', 'sm.product_id', 'p.id')
      .leftJoin('batches as b', 'sm.batch_id', 'b.id')
      .leftJoin('user as u', 'sm.user_id', 'u.id');

    if (filters.product_id) {
      query = query.where('sm.product_id', filters.product_id);
    }

    if (filters.movement_type) {
      query = query.where('sm.movement_type', filters.movement_type);
    }

    if (filters.date_from) {
      query = query.where('sm.created_at', '>=', filters.date_from);
    }

    if (filters.date_to) {
      query = query.where('sm.created_at', '<=', filters.date_to);
    }

    if (filters.user_id) {
      query = query.where('sm.user_id', filters.user_id);
    }

    return await query
      .orderBy('sm.created_at', 'desc')
      .limit(filters.limit || 100);
  }

  static async getStockSummary(productId: string): Promise<StockSummary> {
    const summary = await db('stock_movements')
      .select('movement_type')
      .sum('quantity as total_quantity')
      .where('product_id', productId)
      .groupBy('movement_type');

    return summary.reduce((acc: StockSummary, row: any) => {
      acc[row.movement_type] = parseInt(row.total_quantity) || 0;
      return acc;
    }, {});
  }
}

export default StockMovement;
