import knex from 'knex';
import type { Knex } from 'knex';

export async function up(knexInstance: Knex): Promise<void> {
  return knexInstance.schema.createTable('account', function(table) {
    table.string('id').primary();
    table.string('userId').notNullable();
    table.string('accountId').notNullable();
    table.string('providerId').notNullable();
    table.string('accessToken');
    table.string('refreshToken');
    table.timestamp('accessTokenExpiresAt');
    table.timestamp('refreshTokenExpiresAt');
    table.string('scope');
    table.string('idToken');
    table.string('password');
    table.timestamp('createdAt').notNullable();
    table.timestamp('updatedAt').notNullable();
    
    table.foreign('userId').references('id').inTable('user').onDelete('CASCADE');
  });
}

export async function down(knexInstance: Knex): Promise<void> {
  return knexInstance.schema.dropTable('account');
}
