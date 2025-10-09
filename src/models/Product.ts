import db from '../db/knex.js';

interface ProductData {
  sku: string;
  name: string;
  generic_name?: string;
  description?: string;
  category: string;
  manufacturer?: string;
  unit: string;
  hsn_code: string;
  qr_code?: string;
  image_url?: string;
  gst_rate: number;
  price: number;
  barcode?: string;
  supplier_id: string;
  min_stock_level: number;
  max_stock_level?: number;
  is_active?: boolean;
}

interface ProductFilters {
  category?: string;
  search?: string;
  supplier_id?: string;
}

interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  generic_name?: string;
  description?: string;
  category: string;
  manufacturer?: string;
  unit: string;
  hsn_code: string;
  gst_rate: number;
  price: number;
  barcode?: string;
  image_url?: string;
  supplier_id: string;
  min_stock_level: number;
  max_stock_level?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface StockLevel {
  current_stock: number;
  reserved_stock: number;
  min_stock_level: number;
  max_stock_level: number;
}

class Product {
  static async create(productData: Product): Promise<ProductRecord> {
    const [product] = await db('products')
      .insert(productData)
      .returning('*');
    return product;
  }

  static async findById(id: string): Promise<ProductRecord | undefined> {
    return await db('products')
      .where({ id })
      .first();
  }

  static async findByBarcode(barcode: string): Promise<ProductRecord | undefined> {
    return await db('products')
      .where({ barcode })
      .first();
  }

  static async findAll(filters: ProductFilters = {}): Promise<ProductRecord[]> {
    let query = db('products')
      .select('*')
      .where({ is_active: true });

    if (filters.category) {
      query = query.where({ category: filters.category });
    }

    if (filters.search) {
      query = query.where(function() {
        this.where('name', 'ilike', `%${filters.search}%`)
          .orWhere('generic_name', 'ilike', `%${filters.search}%`)
          .orWhere('manufacturer', 'ilike', `%${filters.search}%`);
      });
    }

    if (filters.supplier_id) {
      query = query.where({ supplier_id: filters.supplier_id });
    }

    return await query.orderBy('name');
  }

  static async update(id: string, updateData: Partial<ProductData>): Promise<ProductRecord> {
    const [product] = await db('products')
      .where({ id })
      .update({ ...updateData, updated_at: new Date() })
      .returning('*');
    return product;
  }

  static async delete(id: string): Promise<number> {
    return await db('products')
      .where({ id })
      .update({ is_active: false, updated_at: new Date() });
  }

  static async getStockLevel(productId: string, branchId: string | null = null): Promise<StockLevel | undefined> {
    let query = db('product_branches as pb')
      .select('pb.current_stock', 'pb.reserved_stock', 'pb.min_stock_level', 'pb.max_stock_level')
      .join('products as p', 'pb.product_id', 'p.id')
      .where('pb.product_id', productId)
      .where('pb.is_active', true);

    if (branchId) {
      query = query.where('pb.branch_id', branchId);
    }

    return await query.first();
  }

  static async updateStock(productId: string, branchId: string, newStock: number): Promise<number> {
    return await db('product_branches')
      .where({ product_id: productId, branch_id: branchId })
      .update({ 
        current_stock: newStock,
        updated_at: new Date()
      });
  }
}

export default Product;
