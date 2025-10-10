import type { Knex } from 'knex';

export async function up(knexInstance: Knex): Promise<void> {
  return knexInstance.schema
    .raw(`
      CREATE TYPE "SaleStatus" AS ENUM (
        'DRAFT',
        'PENDING',
        'COMPLETED',
        'CANCELLED',
        'REFUNDED'
      );
      
      CREATE TYPE "PaymentMethod" AS ENUM (
        'CASH',
        'CARD',
        'UPI',
        'WALLET',
        'NET_BANKING',
        'CHEQUE'
      );
      
      CREATE TYPE "PaymentStatus" AS ENUM (
        'PENDING',
        'COMPLETED',
        'FAILED',
        'REFUNDED'
      );
    `)
    
    // Create customers table
    .createTable('customers', function(table) {
      table.string('id').primary();
      table.string('patient_name').notNullable();
      table.string('patient_phone').notNullable();
      table.string('patient_email');
      table.string('doctor_name').notNullable();
      table.string('doctor_license');
      table.string('doctor_phone');
      table.text('prescription_photo'); // Base64 or URL
      table.text('prescription_text');
      table.string('created_by').references('id').inTable('user').onDelete('SET NULL');
      table.timestamps(true, true);
      
      table.index(['patient_phone']);
      table.index(['patient_email']);
      table.index(['doctor_name']);
      table.index(['created_at']);
    })
    
    // Create sales table
    .createTable('sales', function(table) {
      table.string('id').primary();
      table.string('sale_number').notNullable().unique();
      table.string('customer_id').references('id').inTable('customers').onDelete('SET NULL');
      table.string('cashier_id').references('id').inTable('user').onDelete('SET NULL');
      table.enum('status', ['DRAFT', 'PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED']).defaultTo('DRAFT');
      table.decimal('subtotal', 10, 2).notNullable().defaultTo(0);
      table.decimal('tax_amount', 10, 2).notNullable().defaultTo(0);
      table.decimal('discount_amount', 10, 2).notNullable().defaultTo(0);
      table.decimal('total_amount', 10, 2).notNullable().defaultTo(0);
      table.text('notes');
      table.string('prescription_id').references('id').inTable('prescriptions').onDelete('SET NULL');
      table.timestamps(true, true);
      
      table.index(['sale_number']);
      table.index(['customer_id']);
      table.index(['cashier_id']);
      table.index(['status']);
      table.index(['created_at']);
    })
    
    // Create sale_items table
    .createTable('sale_items', function(table) {
      table.string('id').primary();
      table.string('sale_id').references('id').inTable('sales').onDelete('CASCADE');
      table.string('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.string('batch_id').references('id').inTable('batches').onDelete('SET NULL');
      table.integer('quantity').notNullable();
      table.decimal('unit_price', 10, 2).notNullable();
      table.decimal('total_price', 10, 2).notNullable();
      table.decimal('discount_amount', 10, 2).defaultTo(0);
      table.timestamps(true, true);
      
      table.index(['sale_id']);
      table.index(['product_id']);
      table.index(['batch_id']);
    })
    
    // Create payments table
    .createTable('payments', function(table) {
      table.string('id').primary();
      table.string('sale_id').references('id').inTable('sales').onDelete('CASCADE');
      table.enum('payment_method', ['CASH', 'CARD', 'UPI', 'WALLET', 'NET_BANKING', 'CHEQUE']).notNullable();
      table.enum('status', ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).defaultTo('PENDING');
      table.decimal('amount', 10, 2).notNullable();
      table.string('transaction_id'); // External payment gateway transaction ID
      table.text('payment_notes');
      table.timestamps(true, true);
      
      table.index(['sale_id']);
      table.index(['payment_method']);
      table.index(['status']);
      table.index(['transaction_id']);
    })
    
    // Create sale_audit_logs table
    .createTable('sale_audit_logs', function(table) {
      table.string('id').primary();
      table.string('sale_id').references('id').inTable('sales').onDelete('CASCADE');
      table.string('action').notNullable(); // CREATED, UPDATED, COMPLETED, CANCELLED, REFUNDED
      table.text('description');
      table.json('changes'); // JSON object of what changed
      table.string('performed_by').references('id').inTable('user').onDelete('SET NULL');
      table.string('ip_address');
      table.string('user_agent');
      table.timestamps(true, true);
      
      table.index(['sale_id']);
      table.index(['action']);
      table.index(['performed_by']);
      table.index(['created_at']);
    });
}

export async function down(knexInstance: Knex): Promise<void> {
  return knexInstance.schema
    .dropTableIfExists('sale_audit_logs')
    .dropTableIfExists('payments')
    .dropTableIfExists('sale_items')
    .dropTableIfExists('sales')
    .dropTableIfExists('customers')
    .raw('DROP TYPE IF EXISTS "PaymentStatus"')
    .raw('DROP TYPE IF EXISTS "PaymentMethod"')
    .raw('DROP TYPE IF EXISTS "SaleStatus"');
}
