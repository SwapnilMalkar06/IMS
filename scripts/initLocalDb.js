const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initLocalDatabase() {
    console.log('🚀 Connecting to Local MySQL Workbench on localhost:3306...');

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '852456',
            multipleStatements: true
        });

        console.log('✅ Connected to Local MySQL Server!');

        const schemaSql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');

        console.log('📦 Executing schema.sql to create database and tables...');
        await connection.query(schemaSql);
        console.log('🎉 Database "inventory_system" created and seeded successfully in Local MySQL Workbench!');

        await connection.end();
    } catch (err) {
        console.error('❌ Failed to initialize local MySQL database:', err.message);
        process.exit(1);
    }
}

initLocalDatabase();
