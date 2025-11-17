import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";   // ⬅️ جدید

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ⬅️ اینجا pool را سراسری تعریف می‌کنیم
let pool;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";

// اتصال به دیتابیس داخل تابع async
async function init() {
  try {
    pool = await mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3308,
      waitForConnections: true,
      connectionLimit: 10,
    });

    // تست اتصال
    await pool.query("SELECT 1");
    console.log("✅ Database connected successfully!");

    // مسیر تست
    app.get("/api/hello", (req, res) => {
      res.json({ message: "Hello Library System!" });
    });

    // مسیر نمایش کتاب‌ها
    app.get("/api/books", async (req, res) => {
      try {
        const [rows] = await pool.query(
          "SELECT id, title, author, category, publication_year, available_copies FROM books ORDER BY id DESC"
        );
        res.json(rows);
      } catch (err) {
        console.error("❌ Database error:", err);
        res.status(500).json({ error: "خطا در اتصال به پایگاه داده" });
      }
    });

    // مسیر ثبت‌نام
    app.post("/api/signup", async (req, res) => {
      const { name, email, password } = req.body;

      if (!name || !email || !password)
        return res.status(400).json({ error: "لطفاً تمام فیلدها را پر کنید" });

      try {
        const [exists] = await pool.query(
          "SELECT id FROM users WHERE email = ?",
          [email]
        );
        if (exists.length > 0)
          return res.status(400).json({ error: "ایمیل قبلاً ثبت شده است" });

        const hashed = await bcrypt.hash(password, 10);
        await pool.query(
          "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'member')",
          [name, email, hashed]
        );

        res.json({ message: "ثبت‌نام با موفقیت انجام شد ✅" });
      } catch (err) {
        console.error("❌ Signup error:", err);
        res.status(500).json({ error: "خطا در ثبت‌نام" });
      }
    });

    // اجرای سرور بعد از اتصال موفق
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
}

// 🔐 مسیر ورود کاربر با JWT
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res
      .status(400)
      .json({ error: "لطفاً ایمیل و رمز عبور را وارد کنید" });

  try {
    // بررسی اینکه کاربر وجود دارد یا نه
    const [users] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    if (users.length === 0)
      return res.status(404).json({ error: "کاربری با این ایمیل یافت نشد" });

    const user = users[0];

    // مقایسه رمز عبور
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: "رمز عبور نادرست است" });

    // ساخت توکن JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // پاسخ نهایی
    res.json({
      message: "ورود موفقیت‌آمیز ✅",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "خطا در ورود" });
  }
});

// فراخوانی تابع اصلی
init();
