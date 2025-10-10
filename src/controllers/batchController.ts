import Batch from '../models/Batch.js';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import Alert from '../models/Alert.js';
import { v4 as uuidv4 } from 'uuid';
import { 
  AuthenticatedRequest, 
  ApiResponse, 
  Batch as BatchType,
  CreateBatchRequest,
  UpdateBatchRequest,
  UpdateBatchQuantityRequest,
  StockMovement as StockMovementType
} from '../types.js';

// Type conversion helper functions
const convertBatchRecordToBatch = (record: any): BatchType => ({
  id: record.id,
  batch_number: record.batch_number,
  product_id: record.product_id,
  supplier_id: record.supplier_id,
  manufacturing_date: record.manufacturing_date,
  expiry_date: record.expiry_date,
  initial_quantity: record.initial_quantity,
  current_quantity: record.current_quantity,
  cost_price: record.cost_price,
  is_active: record.is_active,
  created_at: record.created_at,
  updated_at: record.updated_at
});

const convertStockMovementRecordToStockMovement = (record: any): StockMovementType => ({
  ...record,
  movement_type: record.movement_type as 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
});

// Create a new batch
export const createBatch = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const {
      product_id,
      batch_number,
      lot_number,
      manufacturing_date,
      expiry_date,
      initial_quantity,
      cost_price,
      supplier_id,
      notes
    } = req.body as CreateBatchRequest;

    // Check if product exists
    const product = await Product.findById(product_id);
    if (!product) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found'
      };
      res.status(404).json(response);
      return;
    }

    // Check if batch number already exists for this product
    const existingBatch = await Batch.findByBatchNumber(product_id, batch_number);
    if (existingBatch) {
      const response: ApiResponse = {
        success: false,
        error: 'Batch number already exists for this product'
      };
      res.status(400).json(response);
      return;
    }

    const batchData = {
      id: uuidv4(),
      batch_number,
      product_id,
      supplier_id,
      manufacturing_date: new Date(manufacturing_date!),
      expiry_date: new Date(expiry_date),
      initial_quantity,
      current_quantity: initial_quantity,
      cost_price
    };

    const batch = await Batch.create(batchData);

    // Create stock movement record
    await StockMovement.create({
      id: uuidv4(),
      product_id,
      batch_id: batch.id,
      movement_type: 'IN',
      quantity: initial_quantity,
      reason: 'Initial stock',
      user_id: req.user?.id
    });

    // Check for expiry alerts
    const daysUntilExpiry = Math.ceil((new Date(expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 30) {
      await Alert.createExpiryAlert(batch.id, product_id, new Date(expiry_date), daysUntilExpiry);
    }

    const response: ApiResponse<BatchType> = {
      success: true,
      data: convertBatchRecordToBatch(batch),
      message: 'Batch created successfully'
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating batch:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create batch',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get batches for a product
export const getBatchesByProduct = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { productId } = req.params;
    const batches = await Batch.findByProductId(productId);

    const response: ApiResponse<BatchType[]> = {
      success: true,
      data: batches.map(convertBatchRecordToBatch)
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching batches:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch batches',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get batch by ID
export const getBatchById = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const batch = await Batch.findById(id);

    if (!batch) {
      const response: ApiResponse = {
        success: false,
        error: 'Batch not found'
      };
      res.status(404).json(response);
      return;
    }

    // Get stock movements for this batch
    const movements = await StockMovement.findByBatchId(id);

    const response: ApiResponse<BatchType & { movements: StockMovementType[] }> = {
      success: true,
      data: {
        ...convertBatchRecordToBatch(batch),
        movements: movements.map(convertStockMovementRecordToStockMovement)
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching batch:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch batch',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Update batch
export const updateBatch = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body as UpdateBatchRequest;

    const batch = await Batch.findById(id);
    if (!batch) {
      const response: ApiResponse = {
        success: false,
        error: 'Batch not found'
      };
      res.status(404).json(response);
      return;
    }

    const updatedBatch = await Batch.update(id, {
      ...updateData,
      manufacturing_date: updateData.manufacturing_date ? new Date(updateData.manufacturing_date) : undefined,
      expiry_date: updateData.expiry_date ? new Date(updateData.expiry_date) : undefined
    });

    const response: ApiResponse<BatchType> = {
      success: true,
      data: convertBatchRecordToBatch(updatedBatch),
      message: 'Batch updated successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error updating batch:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update batch',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Delete batch (soft delete)
export const deleteBatch = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;

    const batch = await Batch.findById(id);
    if (!batch) {
      const response: ApiResponse = {
        success: false,
        error: 'Batch not found'
      };
      res.status(404).json(response);
      return;
    }

    if (batch.current_quantity > 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Cannot delete batch with remaining stock'
      };
      res.status(400).json(response);
      return;
    }

    await Batch.delete(id);

    const response: ApiResponse = {
      success: true,
      message: 'Batch deleted successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error deleting batch:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete batch',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get expiring batches
export const getExpiringBatches = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { days = 30 } = req.query;
    const batches = await Batch.getExpiringBatches(parseInt(days as string));

    const response: ApiResponse<BatchType[]> = {
      success: true,
      data: batches.map(convertBatchRecordToBatch)
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching expiring batches:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch expiring batches',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get expired batches
export const getExpiredBatches = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const batches = await Batch.getExpiredBatches();

    const response: ApiResponse<BatchType[]> = {
      success: true,
      data: batches.map(convertBatchRecordToBatch)
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching expired batches:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch expired batches',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Update batch quantity
export const updateBatchQuantity = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const { quantity, reason } = req.body as UpdateBatchQuantityRequest;

    const batch = await Batch.findById(id);
    if (!batch) {
      const response: ApiResponse = {
        success: false,
        error: 'Batch not found'
      };
      res.status(404).json(response);
      return;
    }

    const quantityDifference = quantity - batch.current_quantity;
    
    // Update batch quantity
    await Batch.updateQuantity(id, quantity);

    // Create stock movement record
    if (quantityDifference !== 0) {
      await StockMovement.create({
        id: uuidv4(),
        product_id: batch.product_id,
        batch_id: id,
        movement_type: quantityDifference > 0 ? 'IN' : 'OUT',
        quantity: Math.abs(quantityDifference),
        reason: reason || 'Manual adjustment',
        user_id: req.user?.id
      });
    }

    const updatedBatch = await Batch.findById(id);

    const response: ApiResponse<BatchType> = {
      success: true,
      data: convertBatchRecordToBatch(updatedBatch!),
      message: 'Batch quantity updated successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error updating batch quantity:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update batch quantity',
      details: error.message
    };
    res.status(500).json(response);
  }
};
