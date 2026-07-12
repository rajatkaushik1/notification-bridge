// Dual-Engine Database Abstraction Layer (SQLite for local / PostgreSQL for 24/7 Cloud)
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL;

let isPostgres = false;
let pgPool = null;
let sqliteDb = null;

async function initDB() {
    if (DATABASE_URL) {
        console.log('[*] Connecting to Cloud PostgreSQL Database...');
        const { Pool } = require('pg');
        pgPool = new Pool({
            connectionString: DATABASE_URL,
            ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
        });

        isPostgres = true;

        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS calls (
                id VARCHAR(128) PRIMARY KEY,
                number VARCHAR(64),
                contact_name VARCHAR(255),
                status VARCHAR(64),
                message TEXT,
                timestamp VARCHAR(64),
                notes TEXT,
                tag VARCHAR(64)
            );
        `);
        console.log('[+] PostgreSQL Database initialized successfully.');
    } else {
        console.log('[*] Using local SQLite Database (calls.db)...');
        const sqlite3 = require('sqlite3').verbose();
        const dbPath = path.join(__dirname, 'calls.db');

        sqliteDb = new sqlite3.Database(dbPath);

        await new Promise((resolve, reject) => {
            sqliteDb.run(`
                CREATE TABLE IF NOT EXISTS calls (
                    id TEXT PRIMARY KEY,
                    number TEXT,
                    contact_name TEXT,
                    status TEXT,
                    message TEXT,
                    timestamp TEXT,
                    notes TEXT,
                    tag TEXT
                );
            `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log('[+] Local SQLite Database initialized successfully.');
    }
}

async function insertCall(record) {
    const {
        id, number, contactName, status, message, timestamp, notes, tag
    } = record;

    if (isPostgres) {
        const query = `
            INSERT INTO calls (id, number, contact_name, status, message, timestamp, notes, tag)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
                notes = EXCLUDED.notes,
                tag = EXCLUDED.tag;
        `;
        await pgPool.query(query, [id, number, contactName, status, message, timestamp, notes, tag]);
    } else {
        await new Promise((resolve, reject) => {
            sqliteDb.run(`
                INSERT OR REPLACE INTO calls (id, number, contact_name, status, message, timestamp, notes, tag)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [id, number, contactName, status, message, timestamp, notes, tag], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    return record;
}

async function getCalls(limit = 500) {
    if (isPostgres) {
        const res = await pgPool.query(`
            SELECT id, number, contact_name AS "contactName", status, message, timestamp, notes, tag
            FROM calls
            ORDER BY timestamp DESC
            LIMIT $1
        `, [limit]);
        return res.rows;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.all(`
                SELECT id, number, contact_name AS contactName, status, message, timestamp, notes, tag
                FROM calls
                ORDER BY timestamp DESC
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
}

async function getCallsSince(isoTimestamp) {
    if (isPostgres) {
        const res = await pgPool.query(`
            SELECT id, number, contact_name AS "contactName", status, message, timestamp, notes, tag
            FROM calls
            WHERE timestamp > $1
            ORDER BY timestamp DESC
        `, [isoTimestamp]);
        return res.rows;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.all(`
                SELECT id, number, contact_name AS contactName, status, message, timestamp, notes, tag
                FROM calls
                WHERE timestamp > ?
                ORDER BY timestamp DESC
            `, [isoTimestamp], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
}

async function updateCall(id, notes, tag) {
    if (isPostgres) {
        let query = `UPDATE calls SET id = id`;
        const params = [id];
        let idx = 2;
        if (notes !== undefined) {
            query += `, notes = $${idx++}`;
            params.push(notes);
        }
        if (tag !== undefined) {
            query += `, tag = $${idx++}`;
            params.push(tag);
        }
        query += ` WHERE id = $1 RETURNING id, number, contact_name AS "contactName", status, message, timestamp, notes, tag`;
        const res = await pgPool.query(query, params);
        return res.rows[0];
    } else {
        const updates = [];
        const params = [];
        if (notes !== undefined) {
            updates.push(`notes = ?`);
            params.push(notes);
        }
        if (tag !== undefined) {
            updates.push(`tag = ?`);
            params.push(tag);
        }
        params.push(id);
        await new Promise((resolve, reject) => {
            sqliteDb.run(`UPDATE calls SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        return new Promise((resolve, reject) => {
            sqliteDb.get(`SELECT id, number, contact_name AS contactName, status, message, timestamp, notes, tag FROM calls WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

async function deleteCall(id) {
    if (isPostgres) {
        if (id === 'all') {
            await pgPool.query(`DELETE FROM calls`);
        } else {
            await pgPool.query(`DELETE FROM calls WHERE id = $1`, [id]);
        }
    } else {
        await new Promise((resolve, reject) => {
            if (id === 'all') {
                sqliteDb.run(`DELETE FROM calls`, (err) => err ? reject(err) : resolve());
            } else {
                sqliteDb.run(`DELETE FROM calls WHERE id = ?`, [id], (err) => err ? reject(err) : resolve());
            }
        });
    }
}

module.exports = {
    initDB,
    insertCall,
    getCalls,
    getCallsSince,
    updateCall,
    deleteCall
};
