import Product from '../models/Product.js';
import Batch from '../models/Batch.js';
import StockMovement from '../models/StockMovement.js';
import { v4 as uuidv4 } from 'uuid';
import { 
  AuthenticatedRequest, 
  ApiResponse, 
  Product as ProductType,
  CreateProductRequest,
  UpdateProductRequest,
  ProductFilters,
  StockInfo,
  Batch as BatchType,
  StockMovement as StockMovementType
} from '../types.js';

// Create a new product
export const createProduct = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const {
      name,
      description,
      generic_name,
      manufacturer,
      barcode,
      image_url,
      qr_code,
      category,
      unit_price,
      selling_price,
      unit_of_measure,
      pack_size,
      min_stock_level,
      max_stock_level,
      requires_prescription,
      supplier_id
    } = req.body as unknown as CreateProductRequest;

    // Check if barcode already exists
    if (barcode) {
      const existingProduct = await Product.findByBarcode(barcode);
      if (existingProduct) {
        const response: ApiResponse = {
          success: false,
          error: 'Product with this barcode already exists'
        };
        res.status(400).json(response);
        return;
      }
    }

    const productData = {
      id: uuidv4(),
      name,
      description,
      generic_name,
      manufacturer,
      barcode,
      qr_code,
      image_url,
      category,
      unit_price,
      selling_price,
      unit_of_measure,
      pack_size: pack_size || 1,
      min_stock_level: min_stock_level || 10,
      max_stock_level: max_stock_level || 1000,
      requires_prescription: requires_prescription ?? false,
      supplier_id: supplier_id || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const product = await Product.create(productData);

    const response: ApiResponse<Product> = {
      success: true,
      data: product,
      message: 'Product created successfully'
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating product:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create product',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get all products with filters
export const getProducts = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const {
      category,
      search,
      supplier_id,
      page = 1,
      limit = 20
    } = req.query as ProductFilters;

    const filters = {
      category,
      search,
      supplier_id
    };

    const products = await Product.findAll(filters);
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedProducts = products.slice(startIndex, endIndex);

    const response: ApiResponse<ProductType[]> = {
      success: true,
      data: paginatedProducts,
      pagination: {
        current_page: parseInt(page.toString()),
        per_page: parseInt(limit.toString()),
        total: products.length,
        total_pages: Math.ceil(products.length / limit)
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch products',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get product by ID
export const getProductById = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found'
      };
      res.status(404).json(response);
      return;
    }

    // Get stock information
    const stockInfo = await Product.getStockLevel(id);
    const batches = await Batch.findByProductId(id);

    const response: ApiResponse<ProductType & { stock_info: StockInfo; batches: BatchType[] }> = {
      success: true,
      data: {
        ...product,
        stock_info: stockInfo,
        batches
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching product:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch product',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Update product
export const updateProduct = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body as UpdateProductRequest;

    // Check if product exists
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found'
      };
      res.status(404).json(response);
      return;
    }

    // Check if barcode is being updated and already exists
    if (updateData.barcode && updateData.barcode !== existingProduct.barcode) {
      const barcodeExists = await Product.findByBarcode(updateData.barcode);
      if (barcodeExists) {
        const response: ApiResponse = {
          success: false,
          error: 'Product with this barcode already exists'
        };
        res.status(400).json(response);
        return;
      }
    }

    const updatedProduct = await Product.update(id, updateData);

    const response: ApiResponse<ProductType> = {
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error updating product:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update product',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Delete product (soft delete)
export const deleteProduct = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found'
      };
      res.status(404).json(response);
      return;
    }

    await Product.delete(id);

    const response: ApiResponse = {
      success: true,
      message: 'Product deleted successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error deleting product:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete product',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get product by barcode
export const getProductByBarcode = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { barcode } = req.params;
    const product = await Product.findByBarcode(barcode);

    if (!product) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found'
      };
      res.status(404).json(response);
      return;
    }

    // Get stock information
    const stockInfo = await Product.getStockLevel(product.id);
    const batches = await Batch.findByProductId(product.id);

    const response: ApiResponse<ProductType & { stock_info: StockInfo; batches: BatchType[] }> = {
      success: true,
      data: {
        ...product,
        stock_info: stockInfo,
        batches
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching product by barcode:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch product',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get product stock history
export const getProductStockHistory = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const movements = await StockMovement.findByProductId(id, parseInt(limit as string));
    const summary = await StockMovement.getStockSummary(id);

    const response: ApiResponse<{
      movements: StockMovementType[];
      summary: any;
    }> = {
      success: true,
      data: {
        movements,
        summary
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching stock history:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch stock history',
      details: error.message
    };
    res.status(500).json(response);
  }
};
