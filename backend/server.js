import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// اتصال به دیتابیس
const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3308, // ✅ اضافه کن
    waitForConnections: true,
    connectionLimit: 10,
  });
  
try {
  const [rows] = await pool.query('SELECT 1');
  console.log('✅ Database connected successfully!');
} catch (err) {
  console.error('❌ Database connection failed:', err.message);
}
// مسیر تست
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello Library System!' });
});

// مسیر لیست کتاب‌ها
app.get('/api/books', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, author, publication_year, available_copies FROM books ORDER BY id DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ Database error:', err);
    res.status(500).json({ error: 'خطا در اتصال به پایگاه داده' });
  }
});

// اجرای سرور
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
