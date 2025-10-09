import Product from '../models/Product.js';
import Batch from '../models/Batch.js';
import StockMovement from '../models/StockMovement.js';
import Alert from '../models/Alert.js';
import { v4 as uuidv4 } from 'uuid';
import { 
  AuthenticatedRequest, 
  ApiResponse, 
  Product as ProductType,
  StockInfo,
  Batch as BatchType,
  StockMovement as StockMovementType,
  UpdateStockByBarcodeRequest,
  BulkScanRequest
} from '../types.js';

// Type conversion helper functions
const convertProductRecordToProduct = (record: any): ProductType => ({
  id: record.id,
  name: record.name,
  generic_name: record.generic_name,
  description: record.description,
  image_url: record.image_url,
  category: record.category as 'OTC' | 'PRESCRIPTION' | 'SUPPLEMENTS' | 'MEDICAL_DEVICES' | 'COSMETICS' | 'OTHER',
  manufacturer: record.manufacturer,
  barcode: record.barcode,
  qr_code: record.qr_code,
  unit_price: record.price,
  selling_price: record.price,
  unit_of_measure: record.unit,
  pack_size: undefined,
  min_stock_level: record.min_stock_level,
  max_stock_level: record.max_stock_level,
  requires_prescription: record.category === 'PRESCRIPTION',
  supplier_id: record.supplier_id,
  is_active: record.is_active,
  created_at: record.created_at,
  updated_at: record.updated_at
});

const convertStockLevelToStockInfo = (stock: any): StockInfo => ({
  current_stock: stock.current_stock,
  reserved_stock: stock.reserved_stock,
  min_stock_level: stock.min_stock_level,
  max_stock_level: stock.max_stock_level
});

const convertStockMovementRecordToStockMovement = (record: any): StockMovementType => ({
  ...record,
  movement_type: record.movement_type as 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
});

// Scan barcode and get product information
export const scanBarcode = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { barcode } = req.params;

    const product = await Product.findByBarcode(barcode);
    if (!product) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found',
        data: { barcode }
      };
      res.status(404).json(response);
      return;
    }

    // Get stock information
    const stockInfo = await Product.getStockLevel(product.id);
    const batches = await Batch.findByProductId(product.id);
    
    // Get recent stock movements
    const recentMovements = await StockMovement.findByProductId(product.id, 10);

    const response: ApiResponse<{
      product: ProductType;
      stock_info: StockInfo;
      batches: BatchType[];
      recent_movements: StockMovementType[];
    }> = {
      success: true,
      data: {
        product: convertProductRecordToProduct(product),
        stock_info: convertStockLevelToStockInfo(stockInfo!),
        batches,
        recent_movements: recentMovements.map(convertStockMovementRecordToStockMovement)
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error scanning barcode:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to scan barcode',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Update stock via barcode scan
export const updateStockByBarcode = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { barcode } = req.params;
    const { quantity, movement_type, reason, batch_id } = req.body as UpdateStockByBarcodeRequest;

    const product = await Product.findByBarcode(barcode);
    if (!product) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found'
      };
      res.status(404).json(response);
      return;
    }

    // Get current stock
    const currentStock = await Product.getStockLevel(product.id);
    if (!currentStock) {
      const response: ApiResponse = {
        success: false,
        error: 'Product stock information not found'
      };
      res.status(400).json(response);
      return;
    }

    // Calculate new stock
    let newStock = currentStock.current_stock;
    if (movement_type === 'IN') {
      newStock += quantity;
    } else if (movement_type === 'OUT') {
      newStock -= quantity;
      if (newStock < 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Insufficient stock'
        };
        res.status(400).json(response);
        return;
      }
    } else if (movement_type === 'ADJUSTMENT') {
      newStock = quantity;
    }

    // Update stock
    await Product.updateStock(product.id, '', newStock);

    // Create stock movement record
    await StockMovement.create({
      product_id: product.id,
      batch_id: batch_id || '',
      movement_type,
      quantity,
      reason: reason || 'Barcode scan update',
      user_id: req.user?.id
    });

    // Check for low stock alert
    if (newStock <= product.min_stock_level) {
      await Alert.createLowStockAlert(product.id, newStock, product.min_stock_level);
    }

    // Get updated product information
    const updatedProduct = await Product.findById(product.id);
    const updatedStockInfo = await Product.getStockLevel(product.id);

    const response: ApiResponse<{
      product: ProductType;
      stock_info: StockInfo;
    }> = {
      success: true,
      data: {
        product: convertProductRecordToProduct(updatedProduct!),
        stock_info: convertStockLevelToStockInfo(updatedStockInfo!)
      },
      message: 'Stock updated successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error updating stock by barcode:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update stock',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Generate barcode for product
export const generateBarcode = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found'
      };
      res.status(404).json(response);
      return;
    }

    // Generate a simple barcode (in real implementation, use a proper barcode library)
    const barcode = `BC${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    // Update product with new barcode
    const updatedProduct = await Product.update(productId, { barcode });

    const response: ApiResponse<{
      product: ProductType;
      barcode: string;
    }> = {
      success: true,
      data: {
        product: convertProductRecordToProduct(updatedProduct),
        barcode
      },
      message: 'Barcode generated successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error generating barcode:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to generate barcode',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Bulk barcode scan
export const bulkScanBarcodes = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { barcodes } = req.body as BulkScanRequest;

    if (!Array.isArray(barcodes) || barcodes.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Barcodes array is required'
      };
      res.status(400).json(response);
      return;
    }

    const results = await Promise.all(
      barcodes.map(async (barcode: string) => {
        try {
          const product = await Product.findByBarcode(barcode);
          if (product) {
            const stockInfo = await Product.getStockLevel(product.id);
            return {
              barcode,
              found: true,
              product: convertProductRecordToProduct(product),
              stock_info: convertStockLevelToStockInfo(stockInfo!)
            };
          } else {
            return {
              barcode,
              found: false,
              error: 'Product not found'
            };
          }
        } catch (error: any) {
          return {
            barcode,
            found: false,
            error: error.message
          };
        }
      })
    );

    const response: ApiResponse<typeof results> = {
      success: true,
      data: results
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error in bulk barcode scan:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to scan barcodes',
      details: error.message
    };
    res.status(500).json(response);
  }
};
