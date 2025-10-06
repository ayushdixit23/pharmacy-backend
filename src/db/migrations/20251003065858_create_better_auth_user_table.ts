import type { Knex } from 'knex';

export async function up(knexInstance: Knex): Promise<void> {
  return knexInstance.schema.createTable('user', function(table) {
    table.string('id').primary();
    table.string('name').notNullable();
    table.string('email').notNullable().unique();
    table.boolean('emailVerified').defaultTo(false);
    table.string('phoneNumber').notNullable();
    table.string('pharmacyName').notNullable();
    table.string('drugLicenseNumber').notNullable();
    table.string('image');
    table.enum('role', ['PHARMACIST', 'ADMIN']).defaultTo('PHARMACIST');
    table.enum('subscriptionTier', ['COMMUNITY', 'BASIC', 'PRO', 'ENTERPRISE']).defaultTo('COMMUNITY');
    table.boolean('isActive').defaultTo(true);
    table.timestamp('lastLoginAt');
    table.timestamp('createdAt').defaultTo(knexInstance.fn.now());
    table.timestamp('updatedAt').defaultTo(knexInstance.fn.now());
  });
}

export async function down(knexInstance: Knex): Promise<void> {
  return knexInstance.schema.dropTable('user');
}
