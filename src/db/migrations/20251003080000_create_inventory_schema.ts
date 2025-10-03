import knex from 'knex';
import type { Knex } from 'knex';

export async function up(knexInstance: Knex): Promise<void> {
  return knexInstance.schema
    .raw(`
      CREATE TYPE "ProductCategory" AS ENUM (
        'OTC', 
        'PRESCRIPTION', 
        'SUPPLEMENTS', 
        'MEDICAL_DEVICES', 
        'COSMETICS', 
        'OTHER'
      );
      
      CREATE TYPE "AlertType" AS ENUM (
        'LOW_STOCK', 
        'EXPIRY_WARNING', 
        'EXPIRED', 
        'REORDER_SUGGESTION'
      );
      
      CREATE TYPE "AlertStatus" AS ENUM (
        'ACTIVE', 
        'ACKNOWLEDGED', 
        'RESOLVED'
      );
    `)
    
    // Create suppliers table
    .createTable('suppliers', function(table) {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('contact_person');
      table.string('email');
      table.string('phone');
      table.text('address');
      table.string('license_number');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    })
    
    // Create products table
    .createTable('products', function(table) {
      table.string('id').primary();
      table.string('name').notNullable();
      table.text('description');
      table.string('generic_name');
      table.string('image_url');
      table.string('manufacturer');
      table.string('barcode').unique();
      table.string('qr_code').unique();
      table.enum('category', ['OTC', 'PRESCRIPTION', 'SUPPLEMENTS', 'MEDICAL_DEVICES', 'COSMETICS', 'OTHER']);
      table.decimal('unit_price', 10, 2).notNullable();
      table.decimal('selling_price', 10, 2).notNullable();
      table.string('unit_of_measure').notNullable(); // e.g., 'tablets', 'ml', 'mg'
      table.integer('pack_size').defaultTo(1);
      table.integer('min_stock_level').defaultTo(10);
      table.integer('max_stock_level').defaultTo(1000);
      table.boolean('requires_prescription').defaultTo(false);
      table.boolean('is_active').defaultTo(true);
      table.string('supplier_id').references('id').inTable('suppliers');
      table.timestamps(true, true);
      
      table.index(['category']);
      table.index(['barcode']);
      table.index(['is_active']);
    })
    
    // Create batches table for lot tracking
    .createTable('batches', function(table) {
      table.string('id').primary();
      table.string('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.string('batch_number').notNullable();
      table.string('lot_number');
      table.date('manufacturing_date').notNullable();
      table.date('expiry_date').notNullable();
      table.integer('initial_quantity').notNullable();
      table.integer('current_quantity').notNullable();
      table.decimal('cost_price', 10, 2).notNullable();
      table.string('supplier_id').references('id').inTable('suppliers');
      table.text('notes');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      table.unique(['product_id', 'batch_number']);
      table.index(['expiry_date']);
      table.index(['is_active']);
    })
    
    // Create stock movements table for tracking inventory changes
    .createTable('stock_movements', function(table) {
      table.string('id').primary();
      table.string('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.string('batch_id').references('id').inTable('batches').onDelete('CASCADE');
      table.enum('movement_type', ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER']);
      table.integer('quantity').notNullable();
      table.text('reason');
      table.string('reference_number'); // Invoice, PO, etc.
      table.string('user_id').references('id').inTable('user').onDelete('SET NULL');
      table.timestamps(true, true);
      
      table.index(['product_id']);
      table.index(['movement_type']);
      table.index(['created_at']);
    })
    
    // Create alerts table for low stock and expiry warnings
    .createTable('alerts', function(table) {
      table.string('id').primary();
      table.string('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.string('batch_id').references('id').inTable('batches').onDelete('CASCADE');
      table.enum('alert_type', ['LOW_STOCK', 'EXPIRY_WARNING', 'EXPIRED', 'REORDER_SUGGESTION']);
      table.enum('status', ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']);
      table.text('message').notNullable();
      table.integer('priority').defaultTo(1); // 1=low, 2=medium, 3=high
      table.string('user_id').references('id').inTable('user').onDelete('SET NULL');
      table.timestamp('acknowledged_at');
      table.timestamp('resolved_at');
      table.timestamps(true, true);
      
      table.index(['alert_type']);
      table.index(['status']);
      table.index(['priority']);
    })
    
    // Create user branches table for multi-branch support
    .createTable('user_branches', function(table) {
      table.string('id').primary();
      table.string('user_id').references('id').inTable('user').onDelete('CASCADE');
      table.string('branch_name').notNullable();
      table.text('address');
      table.string('phone');
      table.string('license_number');
      table.boolean('is_primary').defaultTo(false);
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      table.index(['user_id']);
    })
    
    // Create product branches table for branch-specific inventory
    .createTable('product_branches', function(table) {
      table.string('id').primary();
      table.string('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.string('branch_id').references('id').inTable('user_branches').onDelete('CASCADE');
      table.integer('current_stock').defaultTo(0);
      table.integer('reserved_stock').defaultTo(0);
      table.integer('min_stock_level').defaultTo(10);
      table.integer('max_stock_level').defaultTo(1000);
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      table.unique(['product_id', 'branch_id']);
      table.index(['branch_id']);
    });
}

export async function down(knexInstance: Knex): Promise<void> {
  return knexInstance.schema
    .dropTableIfExists('product_branches')
    .dropTableIfExists('user_branches')
    .dropTableIfExists('alerts')
    .dropTableIfExists('stock_movements')
    .dropTableIfExists('batches')
    .dropTableIfExists('products')
    .dropTableIfExists('suppliers')
    .raw(`
      DROP TYPE IF EXISTS "AlertStatus";
      DROP TYPE IF EXISTS "AlertType";
      DROP TYPE IF EXISTS "ProductCategory";
    `);
}
