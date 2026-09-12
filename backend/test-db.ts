import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Database connection successful! Server time:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.error('Failed to connect to the database:', err);
  } finally {
    await pool.end();
  }
}

testConnection();