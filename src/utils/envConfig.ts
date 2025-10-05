import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 8080
export const NODE_ENV = process.env.NODE_ENV
export const DB_HOST = process.env.DB_HOST
export const DB_NAME = process.env.DB_NAME
export const DB_USER = process.env.DB_USER
export const DB_PASSWORD = process.env.DB_PASSWORD
export const DB_PORT = process.env.DB_PORT
export const DB_SSL = process.env.DB_SSL

// SMTP Configuration
export const SMTP_HOST = process.env.SMTP_HOST
export const SMTP_PORT = process.env.SMTP_PORT
export const SMTP_SECURE = process.env.SMTP_SECURE
export const SMTP_USER = process.env.SMTP_USER
export const SMTP_PASS = process.env.SMTP_PASS
export const SMTP_FROM = process.env.SMTP_FROM