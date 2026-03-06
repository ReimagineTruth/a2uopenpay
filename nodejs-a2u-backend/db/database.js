import sqlite3 from "sqlite3";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || "./database.sqlite";

// Create database connection
const createConnection = () => {
  return new sqlite3.Database(DB_PATH);
};

// Promisify database methods for async/await
const setupDatabase = async () => {
  const db = createConnection();
  
  // Promisify methods
  const run = promisify(db.run.bind(db));
  const get = promisify(db.get.bind(db));
  const all = promisify(db.all.bind(db));
  
  // Create tables
  await run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      product_id TEXT NOT NULL,
      amount REAL NOT NULL,
      memo TEXT,
      payment_id TEXT UNIQUE,
      txid TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'submitted', 'completed', 'failed', 'cancelled')),
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create indexes for performance
  await run(`CREATE INDEX IF NOT EXISTS idx_payments_uid ON payments(uid)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at)`);
  
  // Create audit log table
  await run(`
    CREATE TABLE IF NOT EXISTS payment_audit_log (
      id TEXT PRIMARY KEY,
      payment_id TEXT,
      action TEXT NOT NULL,
      status_before TEXT,
      status_after TEXT,
      details TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_id) REFERENCES payments(id)
    )
  `);
  
  console.log("✅ Database initialized successfully");
  
  return { run, get, all, db };
};

let dbInstance = null;

export const initializeDatabase = async () => {
  if (!dbInstance) {
    dbInstance = await setupDatabase();
  }
  return dbInstance;
};

export const getDatabase = () => {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }
  return dbInstance;
};

// Helper function to generate UUID
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export default { createConnection, setupDatabase, initializeDatabase, getDatabase, generateId };
