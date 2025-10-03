import knex from 'knex';
import type { Knex } from 'knex';

export async function up(knexInstance: Knex): Promise<void> {
  return knexInstance.schema.createTable('session', function(table) {
    table.string('id').primary();
    table.string('userId').notNullable();
    table.string('token').notNullable();
    table.timestamp('expiresAt').notNullable();
    table.string('ipAddress');
    table.string('userAgent');
    table.timestamp('createdAt').notNullable();
    table.timestamp('updatedAt').notNullable();
    
    table.foreign('userId').references('id').inTable('user').onDelete('CASCADE');
    table.unique('token');
  });
}

export async function down(knexInstance: Knex): Promise<void> {
  return knexInstance.schema.dropTable('session');
}
