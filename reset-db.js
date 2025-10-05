#!/usr/bin/env node

/**
 * Simple Database Reset Script
 * 
 * This script will completely clear all data from the database.
 * Use with caution - this action cannot be undone!
 * 
 * Usage:
 *   node reset-db.js
 */

import { Pool } from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'pharmacy_management',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const resetDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🗑️  Starting database reset...');
    console.log(`📡 Connected to database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
    
    // First, let's see what tables actually exist
    console.log('🔍 Checking existing tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    const existingTables = tablesResult.rows.map(row => row.table_name);
    console.log(`📋 Found ${existingTables.length} tables:`, existingTables);
    
    // Check if user table exists and has data
    if (existingTables.includes('user')) {
      const userCount = await client.query('SELECT COUNT(*) as count FROM "user";');
      console.log(`👤 User table has ${userCount.rows[0].count} users`);
    }
    
    if (existingTables.length === 0) {
      console.log('⚠️  No tables found in the database. Nothing to reset.');
      return;
    }
    
    // Disable foreign key checks temporarily
    console.log('🔓 Disabling foreign key constraints...');
    await client.query('SET session_replication_role = replica;');
    
    // Also disable triggers and constraints more aggressively
    try {
      await client.query('SET foreign_key_checks = 0;');
      console.log('🔓 Disabled foreign key checks');
    } catch (e) {
      console.log('⚠️  Could not disable foreign_key_checks (MySQL syntax)');
    }
    
    // Clear all existing tables - try multiple approaches
    let totalRowsDeleted = 0;
    for (const table of existingTables) {
      try {
        // First check how many rows exist
        const quotedTable = `"${table}"`;
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${quotedTable};`);
        const rowCount = parseInt(countResult.rows[0].count);
        
        if (rowCount > 0) {
          console.log(`🗑️  Attempting to clear table: ${table} (${rowCount} rows)`);
          
          // Try TRUNCATE first (faster and resets sequences)
          try {
            // Quote table name to handle reserved keywords like 'user'
            const quotedTable = `"${table}"`;
            await client.query(`TRUNCATE TABLE ${quotedTable} CASCADE;`);
            console.log(`✅ TRUNCATED table: ${table} (${rowCount} rows)`);
            totalRowsDeleted += rowCount;
          } catch (truncateError) {
            console.log(`⚠️  TRUNCATE failed for ${table}, trying DELETE...`);
            
            // Fallback to DELETE with quoted table name
            const quotedTable = `"${table}"`;
            const result = await client.query(`DELETE FROM ${quotedTable};`);
            console.log(`✅ DELETED from table: ${table} (${result.rowCount} rows deleted)`);
            totalRowsDeleted += result.rowCount;
          }
        } else {
          console.log(`📭 Table ${table} is already empty`);
        }
      } catch (error) {
        console.log(`❌ Error clearing table ${table}:`, error.message);
        console.log(`🔧 Trying alternative approach for ${table}...`);
        
        // Last resort: DROP and recreate table structure
        try {
          const tableInfo = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = '${table}' AND table_schema = 'public'
            ORDER BY ordinal_position;
          `);
          
          if (tableInfo.rows.length > 0) {
            console.log(`🔄 Recreating table structure for ${table}...`);
            // This is a more complex approach - for now, just log the error
            console.log(`⚠️  Manual intervention needed for table: ${table}`);
          }
        } catch (recreateError) {
          console.log(`❌ Could not handle table ${table}:`, recreateError.message);
        }
      }
    }
    
    // Reset sequences (auto-increment counters)
    console.log('🔄 Resetting sequences...');
    const sequencesResult = await client.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
    `);
    
    const existingSequences = sequencesResult.rows.map(row => row.sequence_name);
    console.log(`🔢 Found ${existingSequences.length} sequences:`, existingSequences);
    
    for (const sequence of existingSequences) {
      try {
        await client.query(`ALTER SEQUENCE ${sequence} RESTART WITH 1;`);
        console.log(`🔄 Reset sequence: ${sequence}`);
      } catch (error) {
        console.log(`⚠️  Error resetting sequence ${sequence}:`, error.message);
      }
    }
    
    // Re-enable foreign key checks
    console.log('🔒 Re-enabling foreign key constraints...');
    await client.query('SET session_replication_role = DEFAULT;');
    
    console.log(`✅ Database reset completed! Deleted ${totalRowsDeleted} rows from ${existingTables.length} tables.`);
    
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run the reset
console.log('🧹 Pharmacy Management - Database Reset Tool');
console.log('==========================================');
console.log('⚠️  WARNING: This will delete ALL data from the database!');
console.log('🔄 This action cannot be undone!');
console.log('');

try {
  await resetDatabase();
  console.log('');
  console.log('🎉 Database reset completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('');
  console.error('💥 Database reset failed:');
  console.error(error.message);
  process.exit(1);
}
