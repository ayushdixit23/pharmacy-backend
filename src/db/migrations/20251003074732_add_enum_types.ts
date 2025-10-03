import type { Knex } from 'knex';

export async function up(knexInstance: Knex): Promise<void> {
  return knexInstance.raw(`
    CREATE TYPE "UserRole" AS ENUM ('PHARMACIST', 'ADMIN');
    CREATE TYPE "SubscriptionTier" AS ENUM ('COMMUNITY', 'BASIC', 'PRO', 'ENTERPRISE');
  `);
}

export async function down(knexInstance: Knex): Promise<void> {
  return knexInstance.raw(`
    DROP TYPE IF EXISTS "SubscriptionTier";
    DROP TYPE IF EXISTS "UserRole";
  `);
}
