import type { Knex } from 'knex';

export async function up(knexInstance: Knex): Promise<void> {
  return knexInstance.schema
    .raw(`
      CREATE TYPE "PrescriptionStatus" AS ENUM (
        'UPLOADED',
        'PENDING_VALIDATION',
        'VALIDATED',
        'DISPENSED',
        'REJECTED',
        'EXPIRED'
      );
      
      CREATE TYPE "PrescriptionType" AS ENUM (
        'IMAGE',
        'PDF',
        'SCANNED'
      );
      
      CREATE TYPE "ValidationStatus" AS ENUM (
        'PENDING',
        'APPROVED',
        'REJECTED',
        'NEEDS_REVISION'
      );
    `)
    
    // Create prescriptions table
    .createTable('prescriptions', function(table) {
      table.string('id').primary();
      table.string('prescription_number').notNullable().unique();
      table.string('patient_name').notNullable();
      table.string('patient_phone');
      table.string('patient_email');
      table.date('patient_dob');
      table.string('patient_address');
      table.string('doctor_name').notNullable();
      table.string('doctor_license');
      table.string('doctor_phone');
      table.string('doctor_specialty');
      table.string('clinic_name');
      table.enum('status', ['UPLOADED', 'PENDING_VALIDATION', 'VALIDATED', 'DISPENSED', 'REJECTED', 'EXPIRED']);
      table.enum('type', ['IMAGE', 'PDF', 'SCANNED']);
      table.string('file_url').notNullable();
      table.string('file_name');
      table.integer('file_size');
      table.string('mime_type');
      table.text('ocr_text'); // AI-extracted text
      table.json('extracted_data'); // Structured data from OCR
      table.enum('validation_status', ['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVISION']);
      table.text('validation_notes');
      table.string('validated_by').references('id').inTable('user').onDelete('SET NULL');
      table.timestamp('validated_at');
      table.string('dispensed_by').references('id').inTable('user').onDelete('SET NULL');
      table.timestamp('dispensed_at');
      table.string('rejected_by').references('id').inTable('user').onDelete('SET NULL');
      table.timestamp('rejected_at');
      table.text('rejection_reason');
      table.string('uploaded_by').references('id').inTable('user').onDelete('SET NULL');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      table.index(['status']);
      table.index(['patient_name']);
      table.index(['doctor_name']);
      table.index(['uploaded_by']);
      table.index(['created_at']);
    })
    
    // Create prescription medications table
    .createTable('prescription_medications', function(table) {
      table.string('id').primary();
      table.string('prescription_id').references('id').inTable('prescriptions').onDelete('CASCADE');
      table.string('medication_name').notNullable();
      table.string('generic_name');
      table.string('dosage').notNullable();
      table.string('frequency').notNullable();
      table.string('duration');
      table.string('instructions');
      table.integer('quantity');
      table.string('unit');
      table.boolean('substitution_allowed').defaultTo(false);
      table.string('product_id').references('id').inTable('products').onDelete('SET NULL');
      table.string('batch_id').references('id').inTable('batches').onDelete('SET NULL');
      table.decimal('unit_price', 10, 2);
      table.decimal('total_price', 10, 2);
      table.boolean('is_dispensed').defaultTo(false);
      table.string('dispensed_by').references('id').inTable('user').onDelete('SET NULL');
      table.timestamp('dispensed_at');
      table.timestamps(true, true);
      
      table.index(['prescription_id']);
      table.index(['medication_name']);
      table.index(['product_id']);
    })
    
    // Create prescription audit logs table
    .createTable('prescription_audit_logs', function(table) {
      table.string('id').primary();
      table.string('prescription_id').references('id').inTable('prescriptions').onDelete('CASCADE');
      table.string('action').notNullable(); // UPLOADED, VALIDATED, DISPENSED, REJECTED, etc.
      table.text('description');
      table.json('changes'); // JSON object of what changed
      table.string('performed_by').references('id').inTable('user').onDelete('SET NULL');
      table.string('ip_address');
      table.string('user_agent');
      table.timestamps(true, true);
      
      table.index(['prescription_id']);
      table.index(['action']);
      table.index(['performed_by']);
      table.index(['created_at']);
    })
    
    // Create prescription sales link table
    .createTable('prescription_sales', function(table) {
      table.string('id').primary();
      table.string('prescription_id').references('id').inTable('prescriptions').onDelete('CASCADE');
      table.string('sale_id').notNullable(); // Reference to sales table (to be created)
      table.decimal('total_amount', 10, 2).notNullable();
      table.string('created_by').references('id').inTable('user').onDelete('SET NULL');
      table.timestamps(true, true);
      
      table.unique(['prescription_id', 'sale_id']);
      table.index(['prescription_id']);
      table.index(['sale_id']);
    });
}

export async function down(knexInstance: Knex): Promise<void> {
  return knexInstance.schema
    .dropTableIfExists('prescription_sales')
    .dropTableIfExists('prescription_audit_logs')
    .dropTableIfExists('prescription_medications')
    .dropTableIfExists('prescriptions')
    .raw(`
      DROP TYPE IF EXISTS "ValidationStatus";
      DROP TYPE IF EXISTS "PrescriptionType";
      DROP TYPE IF EXISTS "PrescriptionStatus";
    `);
}
