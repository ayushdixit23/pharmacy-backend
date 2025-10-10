import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import { v4 as uuidv4 } from 'uuid';
import { 
  AuthenticatedRequest, 
  ApiResponse, 
  Supplier as SupplierType,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  SupplierFilters,
  Product as ProductType
} from '../types.js';

// Type conversion helper function
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

// Create a new supplier
export const createSupplier = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const {
      name,
      contact_person,
      email,
      phone,
      address,
      gst_number,
      license_number
    } = req.body as CreateSupplierRequest;

    const supplierData = {
      id: uuidv4(),
      name,
      contact_person,
      email,
      phone,
      address,
      gst_number,
      license_number
    };

    const supplier = await Supplier.create(supplierData);

    const response: ApiResponse<SupplierType> = {
      success: true,
      data: supplier,
      message: 'Supplier created successfully'
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create supplier',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get all suppliers
export const getSuppliers = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { search, page = 1, limit = 20 } = req.query as SupplierFilters;

    const filters = { search };
    const suppliers = await Supplier.findAll(filters);

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedSuppliers = suppliers.slice(startIndex, endIndex);

    const response: ApiResponse<SupplierType[]> = {
      success: true,
      data: paginatedSuppliers,
      pagination: {
        current_page: parseInt(page.toString()),
        per_page: parseInt(limit.toString()),
        total: suppliers.length,
        total_pages: Math.ceil(suppliers.length / limit)
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch suppliers',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get supplier by ID
export const getSupplierById = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findById(id);

    if (!supplier) {
      const response: ApiResponse = {
        success: false,
        error: 'Supplier not found'
      };
      res.status(404).json(response);
      return;
    }

    // Get additional information
    const productsCount = await Supplier.getProductsCount(id);
    const recentOrders = await Supplier.getRecentOrders(id);

    const response: ApiResponse<SupplierType & { 
      products_count: number; 
      recent_orders: any[] 
    }> = {
      success: true,
      data: {
        ...supplier,
        products_count: productsCount,
        recent_orders: recentOrders
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching supplier:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch supplier',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Update supplier
export const updateSupplier = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body as UpdateSupplierRequest;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      const response: ApiResponse = {
        success: false,
        error: 'Supplier not found'
      };
      res.status(404).json(response);
      return;
    }

    const updatedSupplier = await Supplier.update(id, updateData);

    const response: ApiResponse<SupplierType> = {
      success: true,
      data: updatedSupplier,
      message: 'Supplier updated successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update supplier',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Delete supplier (soft delete)
export const deleteSupplier = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      const response: ApiResponse = {
        success: false,
        error: 'Supplier not found'
      };
      res.status(404).json(response);
      return;
    }

    // Check if supplier has products
    const productsCount = await Supplier.getProductsCount(id);
    if (productsCount > 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Cannot delete supplier with associated products'
      };
      res.status(400).json(response);
      return;
    }

    await Supplier.delete(id);

    const response: ApiResponse = {
      success: true,
      message: 'Supplier deleted successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete supplier',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get supplier products
export const getSupplierProducts = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const products = await Product.findAll({ supplier_id: id });
    
    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = pageNum * limitNum;
    const paginatedProducts = products.slice(startIndex, endIndex);

    const response: ApiResponse<ProductType[]> = {
      success: true,
      data: paginatedProducts.map(convertProductRecordToProduct),
      pagination: {
        current_page: pageNum,
        per_page: limitNum,
        total: products.length,
        total_pages: Math.ceil(products.length / limitNum)
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching supplier products:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch supplier products',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get supplier statistics
export const getSupplierStats = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    
    const productsCount = await Supplier.getProductsCount(id);
    const recentOrders = await Supplier.getRecentOrders(id, 5);
    
    // Calculate total value of products from this supplier
    const db = require('../db/knex');
    const valueStats = await db('products as p')
      .select(
        db.raw('COUNT(*) as total_products'),
        db.raw('SUM(p.unit_price * pb.current_stock) as total_value')
      )
      .leftJoin('product_branches as pb', function(this: any) {
        this.on('pb.product_id', '=', 'p.id')
          .andOn('pb.is_active', '=', db.raw('true'));
      })
      .where('p.supplier_id', id)
      .where('p.is_active', true)
      .first();

    const response: ApiResponse<{
      products_count: number;
      total_products: number;
      total_value: number;
      recent_orders: any[];
    }> = {
      success: true,
      data: {
        products_count: productsCount,
        total_products: parseInt(valueStats.total_products) || 0,
        total_value: parseFloat(valueStats.total_value) || 0,
        recent_orders: recentOrders
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching supplier statistics:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch supplier statistics',
      details: error.message
    };
    res.status(500).json(response);
  }
};
