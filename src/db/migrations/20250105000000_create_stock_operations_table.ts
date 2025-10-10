import type { Knex } from 'knex';

export async function up(knexInstance: Knex): Promise<void> {
  return knexInstance.schema
    .raw(`
      CREATE TYPE "StockOperationType" AS ENUM (
        'SALE',
        'PURCHASE',
        'ADJUSTMENT',
        'TRANSFER'
      );
    `)
    
    // Create stock_operations table for audit trail
    .createTable('stock_operations', function(table) {
      table.string('id').primary();
      table.enum('operation_type', ['SALE', 'PURCHASE', 'ADJUSTMENT', 'TRANSFER']).notNullable();
      table.string('product_id').references('id').inTable('products').onDelete('CASCADE');
      table.string('batch_id').references('id').inTable('batches').onDelete('CASCADE');
      table.integer('quantity_change').notNullable();
      table.integer('previous_quantity').notNullable();
      table.integer('new_quantity').notNullable();
      table.string('user_id').references('id').inTable('user').onDelete('SET NULL');
      table.string('reference_id'); // Reference to sale, purchase, etc.
      table.timestamps(true, true);
      
      table.index(['product_id']);
      table.index(['operation_type']);
      table.index(['user_id']);
      table.index(['reference_id']);
      table.index(['created_at']);
    });
}

export async function down(knexInstance: Knex): Promise<void> {
  return knexInstance.schema
    .dropTableIfExists('stock_operations')
    .raw('DROP TYPE IF EXISTS "StockOperationType"');
}
