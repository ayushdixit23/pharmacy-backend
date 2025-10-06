import db from '../db/knex.js';
import { v4 as uuidv4 } from 'uuid';
import Batch from '../models/Batch.js';
import StockMovement from '../models/StockMovement.js';
import Product from '../models/Product.js';

export interface StockOperation {
  productId: string;
  batchId?: string;
  quantity: number;
  operationType: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'TRANSFER';
  reason?: string;
  userId?: string;
  referenceId?: string;
}

export interface StockReservation {
  productId: string;
  batchId?: string;
  quantity: number;
  reservationType: 'SALE' | 'TRANSFER' | 'ADJUSTMENT';
  referenceId?: string;
  expiresAt: Date;
  userId?: string;
}

export interface StockValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class StockManagementService {
  /**
   * Reserve stock for a pending transaction
   */
  static async reserveStock(reservation: StockReservation): Promise<string> {
    const transaction = await db.transaction();
    
    try {
      // Validate stock availability
      const validation = await this.validateStockAvailability(
        reservation.productId,
        reservation.quantity,
        reservation.batchId
      );
      
      if (!validation.isValid) {
        throw new Error(`Stock validation failed: ${validation.errors.join(', ')}`);
      }

      // Create reservation
      const reservationId = uuidv4();
      await transaction('stock_reservations').insert({
        id: reservationId,
        product_id: reservation.productId,
        batch_id: reservation.batchId,
        quantity: reservation.quantity,
        reservation_type: reservation.reservationType,
        reference_id: reservation.referenceId,
        expires_at: reservation.expiresAt,
        user_id: reservation.userId
      });

      await transaction.commit();
      return reservationId;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Execute stock operation with atomic transaction
   */
  static async executeStockOperation(operation: StockOperation): Promise<string> {
    const transaction = await db.transaction();
    
    try {
      const operationId = uuidv4();
      
      // Get current stock levels
      const currentStock = await this.getCurrentStock(operation.productId);
      
      // Calculate new stock level
      let newStock = currentStock;
      if (operation.operationType === 'SALE' || operation.operationType === 'TRANSFER') {
        newStock -= operation.quantity;
      } else if (operation.operationType === 'PURCHASE' || operation.operationType === 'ADJUSTMENT') {
        newStock += operation.quantity;
      }

      // Validate stock levels
      if (newStock < 0) {
        throw new Error('Insufficient stock for operation');
      }

      // Update batch quantities using FIFO/LIFO logic
      if (operation.batchId) {
        await this.updateBatchStock(operation.batchId, operation.quantity, operation.operationType, transaction);
      } else {
        await this.updateProductStock(operation.productId, operation.quantity, operation.operationType, transaction);
      }

      // Record stock operation
      await transaction('stock_operations').insert({
        id: operationId,
        operation_type: operation.operationType,
        product_id: operation.productId,
        batch_id: operation.batchId,
        quantity_change: operation.quantity,
        previous_quantity: currentStock,
        new_quantity: newStock,
        user_id: operation.userId,
        reference_id: operation.referenceId
      });

      // Create stock movement record
      await StockMovement.create({
        id: uuidv4(),
        product_id: operation.productId,
        batch_id: operation.batchId,
        movement_type: this.getMovementType(operation.operationType),
        quantity: operation.quantity,
        reason: operation.reason,
        user_id: operation.userId,
        reference_id: operation.referenceId
      });

      await transaction.commit();
      return operationId;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get available stock (current - reserved)
   */
  static async getAvailableStock(productId: string, branchId?: string): Promise<number> {
    const result = await db.raw(`
      SELECT get_available_stock(?, ?) as available_stock
    `, [productId, branchId || null]);
    
    return parseInt(result.rows[0].available_stock) || 0;
  }

  /**
   * Get stock with FIFO batch selection
   */
  static async getFIFOBatches(productId: string, quantity: number): Promise<any[]> {
    const result = await db.raw(`
      SELECT * FROM get_fifo_batches(?, ?)
    `, [productId, quantity]);
    
    return result.rows;
  }

  /**
   * Validate stock availability
   */
  static async validateStockAvailability(
    productId: string, 
    quantity: number, 
    batchId?: string
  ): Promise<StockValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if product exists and is active
    const product = await Product.findById(productId);
    if (!product || !product.is_active) {
      errors.push('Product not found or inactive');
      return { isValid: false, errors, warnings };
    }

    // Check available stock
    const availableStock = await this.getAvailableStock(productId);
    if (availableStock < quantity) {
      errors.push(`Insufficient stock. Available: ${availableStock}, Required: ${quantity}`);
    }

    // Check batch-specific availability if batchId provided
    if (batchId) {
      const batch = await Batch.findById(batchId);
      if (!batch || !batch.is_active) {
        errors.push('Batch not found or inactive');
      } else if (batch.current_quantity < quantity) {
        errors.push(`Insufficient batch quantity. Available: ${batch.current_quantity}, Required: ${quantity}`);
      }

      // Check batch expiry
      const expiryDate = new Date(batch.expiry_date);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry <= 0) {
        errors.push('Batch has expired');
      } else if (daysUntilExpiry <= 30) {
        warnings.push(`Batch expires in ${daysUntilExpiry} days`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get current stock level
   */
  private static async getCurrentStock(productId: string): Promise<number> {
    const batches = await Batch.findByProductId(productId);
    return batches.reduce((sum, batch) => sum + batch.current_quantity, 0);
  }

  /**
   * Update batch stock with FIFO logic
   */
  private static async updateBatchStock(
    batchId: string, 
    quantity: number, 
    operationType: string, 
    transaction: any
  ): Promise<void> {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    let newQuantity = batch.current_quantity;
    if (operationType === 'SALE' || operationType === 'TRANSFER') {
      newQuantity -= quantity;
    } else if (operationType === 'PURCHASE' || operationType === 'ADJUSTMENT') {
      newQuantity += quantity;
    }

    if (newQuantity < 0) {
      throw new Error('Insufficient batch quantity');
    }

    await transaction('batches')
      .where('id', batchId)
      .update({ 
        current_quantity: newQuantity,
        updated_at: new Date()
      });
  }

  /**
   * Update product stock using FIFO logic
   */
  private static async updateProductStock(
    productId: string, 
    quantity: number, 
    operationType: string, 
    transaction: any
  ): Promise<void> {
    if (operationType === 'SALE' || operationType === 'TRANSFER') {
      // Use FIFO logic for sales
      const batches = await this.getFIFOBatches(productId, quantity);
      let remainingQuantity = quantity;

      for (const batch of batches) {
        if (remainingQuantity <= 0) break;

        const batchQuantity = Math.min(batch.available_quantity, remainingQuantity);
        await this.updateBatchStock(batch.batch_id, batchQuantity, operationType, transaction);
        remainingQuantity -= batchQuantity;
      }

      if (remainingQuantity > 0) {
        throw new Error('Insufficient stock across all batches');
      }
    } else {
      // For purchases, create new batch or update existing
      await this.handlePurchaseStock(productId, quantity, transaction);
    }
  }

  /**
   * Handle purchase stock (create new batch)
   */
  private static async handlePurchaseStock(
    productId: string, 
    quantity: number, 
    transaction: any
  ): Promise<void> {
    // This would typically create a new batch with purchase details
    // For now, we'll update the first available batch or create a new one
    const batches = await Batch.findByProductId(productId);
    
    if (batches.length > 0) {
      // Update existing batch
      await this.updateBatchStock(batches[0].id, quantity, 'PURCHASE', transaction);
    } else {
      // Create new batch (this would need more details in a real implementation)
      throw new Error('Purchase stock handling requires batch creation - not implemented');
    }
  }

  /**
   * Convert operation type to movement type
   */
  private static getMovementType(operationType: string): 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' {
    switch (operationType) {
      case 'SALE':
        return 'OUT';
      case 'PURCHASE':
        return 'IN';
      case 'ADJUSTMENT':
        return 'ADJUSTMENT';
      case 'TRANSFER':
        return 'TRANSFER';
      default:
        return 'ADJUSTMENT';
    }
  }

  /**
   * Release stock reservation
   */
  static async releaseStockReservation(reservationId: string): Promise<void> {
    await db('stock_reservations')
      .where('id', reservationId)
      .del();
  }

  /**
   * Clean up expired reservations
   */
  static async cleanupExpiredReservations(): Promise<number> {
    return await db('stock_reservations')
      .where('expires_at', '<', new Date())
      .del();
  }

  /**
   * Get stock movement history with filters
   */
  static async getStockHistory(filters: {
    productId?: string;
    batchId?: string;
    movementType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<any[]> {
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

    if (filters.productId) {
      query = query.where('sm.product_id', filters.productId);
    }

    if (filters.batchId) {
      query = query.where('sm.batch_id', filters.batchId);
    }

    if (filters.movementType) {
      query = query.where('sm.movement_type', filters.movementType);
    }

    if (filters.dateFrom) {
      query = query.where('sm.created_at', '>=', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.where('sm.created_at', '<=', filters.dateTo);
    }

    return await query
      .orderBy('sm.created_at', 'desc')
      .limit(filters.limit || 100);
  }
}

export default StockManagementService;
