const mysql = require('mysql2/promise');
require('dotenv').config();

// Create MySQL 8.0 Connection Pool
const dbConfig = process.env.DATABASE_URL
    ? { uri: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'inventory_system',
    };

const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',
    ssl: (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') ? { rejectUnauthorized: false } : undefined
});

// Suppress unhandled background pool errors in mysql2
if (pool.pool) {
    pool.pool.on('error', (err) => {
        console.warn('⚠️ Internal MySQL Pool Warning:', err.message);
    });
}

async function safeQuery(sql, params) {
    try {
        return await pool.query(sql, params);
    } catch (err) {
        console.warn(`⚠️ MySQL Query Warning [${err.code}]:`, err.message);
        throw err;
    }
}

async function safeGetConnection() {
    try {
        return await pool.getConnection();
    } catch (err) {
        console.warn(`⚠️ MySQL Connection Warning [${err.code}]:`, err.message);
        throw err;
    }
}

module.exports = {
    query: safeQuery,
    getConnection: safeGetConnection,
    pool
};
