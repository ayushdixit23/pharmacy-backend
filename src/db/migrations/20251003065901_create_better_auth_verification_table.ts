import knex from 'knex';
import type { Knex } from 'knex';

export async function up(knexInstance: Knex): Promise<void> {
  return knexInstance.schema.createTable('verification', function(table) {
    table.string('id').primary();
    table.string('identifier').notNullable();
    table.string('value').notNullable();
    table.timestamp('expiresAt').notNullable();
    table.timestamp('createdAt').defaultTo(knexInstance.fn.now());
    table.timestamp('updatedAt').defaultTo(knexInstance.fn.now());
  });
}

export async function down(knexInstance: Knex): Promise<void> {
  return knexInstance.schema.dropTable('verification');
}
