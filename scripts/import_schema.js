const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importSchema() {
    const host = process.env.DB_HOST;
    const port = Number(process.env.DB_PORT) || 3306;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME || 'defaultdb';

    if (!host || !user || !password) {
        console.error('❌ Missing database credentials in environment variables (DB_HOST, DB_USER, DB_PASSWORD).');
        process.exit(1);
    }

    console.log(`📡 Connecting to MySQL database on ${host}:${port}...`);

    let conn;
    try {
        conn = await mysql.createConnection({
            host,
            port,
            user,
            password,
            database,
            ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
            multipleStatements: true
        });

        console.log('✅ Connected successfully to MySQL database!');

        const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');

        console.log('⏳ Executing schema.sql to set up tables and seed data...');
        await conn.query(schemaSql);
        
        console.log('🎉 Database setup complete! All tables and seed data successfully created.');

        const [tables] = await conn.query('SHOW TABLES;');
        console.log('📋 Tables in database:', tables.map(t => Object.values(t)[0]));

    } catch (err) {
        console.error('❌ Error during schema import:', err.message);
    } finally {
        if (conn) await conn.end();
    }
}

importSchema();
