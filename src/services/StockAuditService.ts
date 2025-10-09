import db from '../db/knex.js';
import { v4 as uuidv4 } from 'uuid';

export interface AuditEvent {
  id: string;
  eventType: 'STOCK_MOVEMENT' | 'STOCK_RESERVATION' | 'STOCK_RELEASE' | 'STOCK_VALIDATION' | 'STOCK_ERROR';
  productId: string;
  batchId?: string;
  userId?: string;
  details: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface StockAuditFilters {
  productId?: string;
  batchId?: string;
  userId?: string;
  eventType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

export class StockAuditService {
  /**
   * Log an audit event
   */
  static async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    const eventId = uuidv4();
    
    await db('stock_audit_log').insert({
      id: eventId,
      event_type: event.eventType,
      product_id: event.productId,
      batch_id: event.batchId,
      user_id: event.userId,
      details: JSON.stringify(event.details),
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      created_at: new Date()
    });
    
    return eventId;
  }

  /**
   * Get audit trail for a product
   */
  static async getProductAuditTrail(
    productId: string, 
    filters: StockAuditFilters = {}
  ): Promise<AuditEvent[]> {
    let query = db('stock_audit_log as sal')
      .select(
        'sal.*',
        'p.name as product_name',
        'b.batch_number',
        'u.name as user_name'
      )
      .join('products as p', 'sal.product_id', 'p.id')
      .leftJoin('batches as b', 'sal.batch_id', 'b.id')
      .leftJoin('user as u', 'sal.user_id', 'u.id')
      .where('sal.product_id', productId);

    if (filters.eventType) {
      query = query.where('sal.event_type', filters.eventType);
    }

    if (filters.userId) {
      query = query.where('sal.user_id', filters.userId);
    }

    if (filters.dateFrom) {
      query = query.where('sal.created_at', '>=', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.where('sal.created_at', '<=', filters.dateTo);
    }

    const results = await query
      .orderBy('sal.created_at', 'desc')
      .limit(filters.limit || 100);

    return results.map(row => ({
      id: row.id,
      eventType: row.event_type,
      productId: row.product_id,
      batchId: row.batch_id,
      userId: row.user_id,
      details: JSON.parse(row.details),
      timestamp: row.created_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent
    }));
  }

  /**
   * Get stock movement summary
   */
  static async getStockMovementSummary(
    productId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    totalIn: number;
    totalOut: number;
    netChange: number;
    movementCount: number;
    lastMovement: Date | null;
  }> {
    let query = db('stock_movements')
      .where('product_id', productId);

    if (dateFrom) {
      query = query.where('created_at', '>=', dateFrom);
    }

    if (dateTo) {
      query = query.where('created_at', '<=', dateTo);
    }

    const movements = await query.select('movement_type', 'quantity', 'created_at');
    
    const summary = movements.reduce((acc, movement) => {
      if (movement.movement_type === 'IN') {
        acc.totalIn += movement.quantity;
      } else if (movement.movement_type === 'OUT') {
        acc.totalOut += movement.quantity;
      }
      acc.movementCount++;
      return acc;
    }, {
      totalIn: 0,
      totalOut: 0,
      netChange: 0,
      movementCount: 0,
      lastMovement: null
    });

    summary.netChange = summary.totalIn - summary.totalOut;
    summary.lastMovement = movements.length > 0 ? 
      new Date(Math.max(...movements.map(m => new Date(m.created_at).getTime()))) : 
      null;

    return summary;
  }

  /**
   * Get user activity summary
   */
  static async getUserActivitySummary(
    userId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    totalMovements: number;
    productsAffected: number;
    totalQuantityMoved: number;
    mostActiveProduct: string | null;
  }> {
    let query = db('stock_movements')
      .where('user_id', userId);

    if (dateFrom) {
      query = query.where('created_at', '>=', dateFrom);
    }

    if (dateTo) {
      query = query.where('created_at', '<=', dateTo);
    }

    const movements = await query.select('product_id', 'quantity');
    
    const productCounts = movements.reduce((acc, movement) => {
      acc[movement.product_id] = (acc[movement.product_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const productKeys = Object.keys(productCounts);
    const mostActiveProduct = productKeys.length > 0 ? productKeys.reduce((a, b) => 
      productCounts[a] > productCounts[b] ? a : b
    ) : null;

    return {
      totalMovements: movements.length,
      productsAffected: Object.keys(productCounts).length,
      totalQuantityMoved: movements.reduce((sum, m) => sum + m.quantity, 0),
      mostActiveProduct
    };
  }

  /**
   * Get stock discrepancies
   */
  static async getStockDiscrepancies(): Promise<Array<{
    productId: string;
    productName: string;
    calculatedStock: number;
    recordedStock: number;
    discrepancy: number;
    lastVerified: Date | null;
  }>> {
    const discrepancies = await db.raw(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        COALESCE(SUM(b.current_quantity), 0) as calculated_stock,
        COALESCE(pb.current_stock, 0) as recorded_stock,
        COALESCE(SUM(b.current_quantity), 0) - COALESCE(pb.current_stock, 0) as discrepancy,
        pb.updated_at as last_verified
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id AND b.is_active = true
      LEFT JOIN product_branches pb ON p.id = pb.product_id AND pb.is_active = true
      WHERE p.is_active = true
      GROUP BY p.id, p.name, pb.current_stock, pb.updated_at
      HAVING ABS(COALESCE(SUM(b.current_quantity), 0) - COALESCE(pb.current_stock, 0)) > 0
      ORDER BY ABS(discrepancy) DESC
    `);

    return discrepancies.rows.map((row: any) => ({
      productId: row.product_id,
      productName: row.product_name,
      calculatedStock: parseInt(row.calculated_stock),
      recordedStock: parseInt(row.recorded_stock),
      discrepancy: parseInt(row.discrepancy),
      lastVerified: row.last_verified
    }));
  }

  /**
   * Generate stock report
   */
  static async generateStockReport(
    filters: {
      productIds?: string[];
      dateFrom?: Date;
      dateTo?: Date;
      includeMovements?: boolean;
      includeDiscrepancies?: boolean;
    } = {}
  ): Promise<{
    summary: {
      totalProducts: number;
      totalStockValue: number;
      totalMovements: number;
      discrepanciesFound: number;
    };
    products: Array<{
      productId: string;
      productName: string;
      currentStock: number;
      stockValue: number;
      movements: any[];
    }>;
    discrepancies: any[];
  }> {
    // Get product summary
    let productQuery = db('products as p')
      .select(
        'p.id',
        'p.name',
        db.raw('COALESCE(SUM(b.current_quantity), 0) as current_stock'),
        db.raw('COALESCE(SUM(b.current_quantity * b.cost_price), 0) as stock_value')
      )
      .leftJoin('batches as b', function() {
        this.on('p.id', '=', 'b.product_id').andOn('b.is_active', '=', db.raw('true'));
      })
      .where('p.is_active', true);

    if (filters.productIds && filters.productIds.length > 0) {
      productQuery = productQuery.whereIn('p.id', filters.productIds);
    }

    const products = await productQuery.groupBy('p.id', 'p.name');

    // Get movements if requested
    let movements: any[] = [];
    if (filters.includeMovements) {
      let movementQuery = db('stock_movements as sm')
        .select(
          'sm.*',
          'p.name as product_name',
          'b.batch_number',
          'u.name as user_name'
        )
        .join('products as p', 'sm.product_id', 'p.id')
        .leftJoin('batches as b', 'sm.batch_id', 'b.id')
        .leftJoin('user as u', 'sm.user_id', 'u.id');

      if (filters.productIds && filters.productIds.length > 0) {
        movementQuery = movementQuery.whereIn('sm.product_id', filters.productIds);
      }

      if (filters.dateFrom) {
        movementQuery = movementQuery.where('sm.created_at', '>=', filters.dateFrom);
      }

      if (filters.dateTo) {
        movementQuery = movementQuery.where('sm.created_at', '<=', filters.dateTo);
      }

      movements = await movementQuery.orderBy('sm.created_at', 'desc');
    }

    // Get discrepancies if requested
    let discrepancies: any[] = [];
    if (filters.includeDiscrepancies) {
      discrepancies = await this.getStockDiscrepancies();
    }

    // Calculate summary
    const totalProducts = products.length;
    const totalStockValue = products.reduce((sum, p) => sum + parseFloat(p.stock_value), 0);
    const totalMovements = movements.length;
    const discrepanciesFound = discrepancies.length;

    return {
      summary: {
        totalProducts,
        totalStockValue,
        totalMovements,
        discrepanciesFound
      },
      products: products.map(p => ({
        productId: p.id,
        productName: p.name,
        currentStock: parseInt(p.current_stock),
        stockValue: parseFloat(p.stock_value),
        movements: movements.filter(m => m.product_id === p.id)
      })),
      discrepancies
    };
  }

  /**
   * Clean up old audit logs
   */
  static async cleanupOldAuditLogs(daysToKeep: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    return await db('stock_audit_log')
      .where('created_at', '<', cutoffDate)
      .del();
  }
}

export default StockAuditService;
