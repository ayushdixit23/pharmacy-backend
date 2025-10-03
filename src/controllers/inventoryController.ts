import Product from '../models/Product.js';
import Batch from '../models/Batch.js';
import StockMovement from '../models/StockMovement.js';
import { 
  AuthenticatedRequest, 
  ApiResponse,
  Product as ProductType,
  Batch as BatchType,
  StockMovement as StockMovementType
} from '../types.js';

// Get inventory stock summary
export const getInventoryStock = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { productId, lowStock, expiringSoon } = req.query;

    // Get all products with their batches
    const products = await Product.findAll();
    
    // Calculate summary statistics
    let totalProducts = products.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiringSoonCount = 0;
    let totalStockValue = 0;
    let totalStockUnits = 0;

    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const lowStockProducts: any[] = [];
    const expiringProducts: any[] = [];
    const recentMovements: any[] = [];

    // Process each product
    for (const product of products) {
      const batches = await Batch.findByProductId(product.id);
      const totalStock = batches.reduce((sum, batch) => sum + batch.current_quantity, 0);
      const stockValue = batches.reduce((sum, batch) => sum + (batch.current_quantity * batch.cost_price), 0);
      
      totalStockUnits += totalStock;
      totalStockValue += stockValue;

      // Check for low stock
      if (totalStock <= product.min_stock_level) {
        lowStockCount++;
        if (totalStock === 0) {
          outOfStockCount++;
        }
        lowStockProducts.push({
          id: product.id,
          name: product.name,
          currentStock: totalStock,
          minStockLevel: product.min_stock_level,
          category: product.category,
          barcode: product.barcode
        });
      }

      // Check for expiring batches
      const expiringBatches = batches.filter(batch => {
        const expiryDate = new Date(batch.expiry_date);
        return expiryDate <= thirtyDaysFromNow && batch.current_quantity > 0;
      });

      if (expiringBatches.length > 0) {
        expiringSoonCount++;
        expiringProducts.push({
          id: product.id,
          name: product.name,
          batches: expiringBatches.map(batch => ({
            id: batch.id,
            batchNumber: batch.batch_number,
            quantity: batch.current_quantity,
            expiryDate: batch.expiry_date,
            daysUntilExpiry: Math.ceil((new Date(batch.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          }))
        });
      }
    }

    // Get recent stock movements (last 10)
    const recentStockMovements = await StockMovement.findRecent(10);
    recentMovements.push(...recentStockMovements.map(movement => ({
      id: movement.id,
      productName: movement.product_name,
      movementType: movement.movement_type,
      quantity: movement.quantity,
      reason: movement.reason,
      createdAt: movement.created_at,
      batchNumber: movement.batch_number,
      userName: movement.user_name
    })));

    // Calculate turnover rate (simplified)
    const averageStock = totalStockUnits / Math.max(totalProducts, 1);
    const totalSalesQuantity = recentMovements
      .filter(m => m.movementType === 'OUT')
      .reduce((sum, m) => sum + m.quantity, 0);
    const turnoverRate = averageStock > 0 ? (totalSalesQuantity / 7) / averageStock : 0;

    const response: ApiResponse = {
      success: true,
      data: {
        summary: {
          totalProducts,
          lowStockCount,
          outOfStockCount,
          expiringSoonCount,
          totalStockValue: Math.round(totalStockValue),
          totalStockUnits,
          turnoverRate: Math.round(turnoverRate * 100) / 100,
        },
        alerts: {
          lowStockProducts: lowStockProducts.slice(0, 10),
          expiringProducts: expiringProducts.slice(0, 10),
        },
        recentMovements,
        lastUpdated: new Date().toISOString(),
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching inventory stock:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch inventory stock data',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get product stock details
export const getProductStock = async (req: AuthenticatedRequest, res: any): Promise<void> => {
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

    const batches = await Batch.findByProductId(productId);
    const stockMovements = await StockMovement.findByProductId(productId, 50);

    const totalStock = batches.reduce((sum, batch) => sum + batch.current_quantity, 0);
    const stockValue = batches.reduce((sum, batch) => sum + (batch.current_quantity * batch.cost_price), 0);

    const response: ApiResponse = {
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          category: product.category,
          barcode: product.barcode,
          minStockLevel: product.min_stock_level,
          maxStockLevel: product.max_stock_level
        },
        stock: {
          totalStock,
          stockValue: Math.round(stockValue),
          batches: batches.map(batch => ({
            id: batch.id,
            batchNumber: batch.batch_number,
            currentQuantity: batch.current_quantity,
            costPrice: batch.cost_price,
            expiryDate: batch.expiry_date,
            daysUntilExpiry: Math.ceil((new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          }))
        },
        movements: stockMovements.map(movement => ({
          id: movement.id,
          movementType: movement.movement_type,
          quantity: movement.quantity,
          reason: movement.reason,
          createdAt: movement.created_at,
          batchNumber: movement.batch_number,
          userName: movement.user_name
        }))
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching product stock:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch product stock data',
      details: error.message
    };
    res.status(500).json(response);
  }
};
