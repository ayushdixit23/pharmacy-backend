import db from '../db/knex.js';

interface SupplierData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gst_number?: string;
  license_number?: string;
  contact_person?: string;
  is_active?: boolean;
}

interface SupplierFilters {
  search?: string;
}

interface SupplierRecord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gst_number?: string;
  license_number?: string;
  contact_person?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SupplierProductCount {
  count: string;
}

interface SupplierOrderRecord {
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
  product_name: string;
  batch_number?: string;
}

class Supplier {
  static async create(supplierData: SupplierData): Promise<SupplierRecord> {
    const [supplier] = await db('suppliers')
      .insert(supplierData)
      .returning('*');
    return supplier;
  }

  static async findById(id: string): Promise<SupplierRecord | undefined> {
    return await db('suppliers')
      .where({ id })
      .first();
  }

  static async findAll(filters: SupplierFilters = {}): Promise<SupplierRecord[]> {
    let query = db('suppliers')
      .select('*')
      .where({ is_active: true });

    if (filters.search) {
      query = query.where(function() {
        this.where('name', 'ilike', `%${filters.search}%`)
          .orWhere('contact_person', 'ilike', `%${filters.search}%`)
          .orWhere('email', 'ilike', `%${filters.search}%`);
      });
    }

    return await query.orderBy('name');
  }

  static async update(id: string, updateData: Partial<SupplierData>): Promise<SupplierRecord> {
    const [supplier] = await db('suppliers')
      .where({ id })
      .update({ ...updateData, updated_at: new Date() })
      .returning('*');
    return supplier;
  }

  static async delete(id: string): Promise<number> {
    return await db('suppliers')
      .where({ id })
      .update({ is_active: false, updated_at: new Date() });
  }

  static async getProductsCount(supplierId: string): Promise<number> {
    const result = await db('products')
      .where({ supplier_id: supplierId, is_active: true })
      .count('id as count')
      .first();
    
    return parseInt((result as any).count);
  }

  static async getRecentOrders(supplierId: string, limit: number = 10): Promise<SupplierOrderRecord[]> {
    return await db('stock_movements as sm')
      .select(
        'sm.*',
        'p.name as product_name',
        'b.batch_number'
      )
      .join('products as p', 'sm.product_id', 'p.id')
      .leftJoin('batches as b', 'sm.batch_id', 'b.id')
      .where('p.supplier_id', supplierId)
      .where('sm.movement_type', 'IN')
      .orderBy('sm.created_at', 'desc')
      .limit(limit);
  }
}

export default Supplier;
