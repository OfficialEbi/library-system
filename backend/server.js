import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------
// تنظیمات JWT
// ----------------------
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";

// ----------------------
// اتصال به دیتابیس
// ----------------------
let pool;

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

    await pool.query("SELECT 1");
    console.log("✅ Database connected successfully!");

    // -----------------------------
    // Middlewares
    // -----------------------------
    function auth(req, res, next) {
      const header = req.headers.authorization;
      if (!header) return res.status(401).json({ error: "توکن وجود ندارد" });

      const token = header.split(" ")[1];
      try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
      } catch {
        return res.status(403).json({ error: "توکن نامعتبر است" });
      }
    }

    function admin(req, res, next) {
      if (req.user.role !== "admin") {
        return res.status(403).json({ error: "دسترسی فقط برای ادمین" });
      }
      next();
    }

    // --------------------------------------
    // 📘 API عمومی کتاب‌ها (برای index.html)
    // --------------------------------------
    app.get("/api/public/books", async (req, res) => {
      try {
        const [rows] = await pool.query("SELECT * FROM books ORDER BY id DESC");
        res.json(rows);
      } catch (err) {
        res.status(500).json({ error: "خطا در دریافت کتاب‌ها" });
      }
    });

    // --------------------------------------
    // 📘 CRUD کتاب‌ها (فقط برای ادمین)
    // --------------------------------------

    // نمایش همه کتاب‌ها
    app.get("/api/books", auth, admin, async (req, res) => {
      try {
        const [rows] = await pool.query("SELECT * FROM books ORDER BY id DESC");
        res.json(rows);
      } catch (err) {
        res.status(500).json({ error: "خطا در دریافت کتاب‌ها" });
      }
    });

    // افزودن کتاب
    app.post("/api/books", auth, admin, async (req, res) => {
      const { title, author, category, publication_year, available_copies } =
        req.body;

      try {
        await pool.query(
          "INSERT INTO books (title, author, category, publication_year, available_copies) VALUES (?, ?, ?, ?, ?)",
          [title, author, category, publication_year, available_copies]
        );
        res.json({ message: "کتاب با موفقیت اضافه شد" });
      } catch (err) {
        res.status(500).json({ error: "خطا در افزودن کتاب" });
      }
    });

    // حذف کتاب
    app.delete("/api/books/:id", auth, admin, async (req, res) => {
      try {
        await pool.query("DELETE FROM books WHERE id=?", [req.params.id]);
        res.json({ message: "کتاب حذف شد" });
      } catch (err) {
        res.status(500).json({ error: "خطا در حذف کتاب" });
      }
    });

    // ویرایش کتاب
    app.put("/api/books/:id", auth, admin, async (req, res) => {
      const { title, author, category, publication_year, available_copies } =
        req.body;

      try {
        await pool.query(
          "UPDATE books SET title=?, author=?, category=?, publication_year=?, available_copies=? WHERE id=?",
          [
            title,
            author,
            category,
            publication_year,
            available_copies,
            req.params.id,
          ]
        );
        res.json({ message: "کتاب ویرایش شد" });
      } catch (err) {
        res.status(500).json({ error: "خطا در ویرایش" });
      }
    });

    // --------------------------------------
    // 👤 مدیریت کاربران
    // --------------------------------------

    // لیست کاربران (همه نقش‌ها، شامل pending)
    app.get("/api/users", auth, admin, async (req, res) => {
      try {
        const [rows] = await pool.query(
          "SELECT id, name, email, role FROM users ORDER BY id DESC"
        );
        res.json(rows);
      } catch (err) {
        res.status(500).json({ error: "خطا در دریافت کاربران" });
      }
    });

    // تایید کاربر pending → member
    app.put("/api/users/:id/approve", auth, admin, async (req, res) => {
      try {
        await pool.query("UPDATE users SET role='member' WHERE id=?", [
          req.params.id,
        ]);
        res.json({ message: "کاربر تایید شد" });
      } catch (err) {
        res.status(500).json({ error: "خطا در تایید کاربر" });
      }
    });

    // ثبت کاربر جدید توسط مدیر
    app.post("/api/admin/users", auth, admin, async (req, res) => {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password)
        return res.status(400).json({ error: "نام، ایمیل و رمز عبور الزامی است" });

      try {
        const [exists] = await pool.query("SELECT id FROM users WHERE email=?", [
          email,
        ]);
        if (exists.length > 0)
          return res.status(400).json({ error: "ایمیل تکراری است" });

        const hashed = await bcrypt.hash(password, 10);

        await pool.query(
          "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
          [name, email, hashed, role || "member"]
        );

        res.json({ message: "عضو جدید ثبت شد" });
      } catch (err) {
        res.status(500).json({ error: "خطا در ثبت عضو" });
      }
    });

    // ویرایش کاربر توسط مدیر
    app.put("/api/admin/users/:id", auth, admin, async (req, res) => {
      const { name, email, role } = req.body;

      try {
        await pool.query(
          "UPDATE users SET name=?, email=?, role=? WHERE id=?",
          [name, email, role, req.params.id]
        );

        res.json({ message: "عضو ویرایش شد" });
      } catch (err) {
        res.status(500).json({ error: "خطا در ویرایش عضو" });
      }
    });

    // حذف کاربر توسط مدیر
    app.delete("/api/admin/users/:id", auth, admin, async (req, res) => {
      try {
        await pool.query("DELETE FROM users WHERE id=?", [req.params.id]);
        res.json({ message: "عضو حذف شد" });
      } catch (err) {
        res.status(500).json({ error: "خطا در حذف عضو" });
      }
    });

    // --------------------------------------
    // 📊 API آمار داشبورد
    // --------------------------------------

    // تعداد کتاب‌ها
    app.get("/api/stats/books", auth, admin, async (req, res) => {
      const [[row]] = await pool.query("SELECT COUNT(*) AS count FROM books");
      res.json({ count: row.count });
    });

    // تعداد کاربران تایید شده
    app.get("/api/stats/users", auth, admin, async (req, res) => {
      const [[row]] = await pool.query(
        "SELECT COUNT(*) AS count FROM users WHERE role='member'"
      );
      res.json({ count: row.count });
    });

    // تعداد امانت‌های فعال
    app.get("/api/stats/borrows", auth, admin, async (req, res) => {
      try {
        const [[row]] = await pool.query(
          "SELECT COUNT(*) AS count FROM borrows WHERE returned = 0"
        );
        res.json({ count: row.count });
      } catch {
        res.json({ count: 0 });
      }
    });

    // --------------------------------------
    // 📝 ثبت‌نام (کاربر عادی → pending)
    // --------------------------------------
    app.post("/api/signup", async (req, res) => {
      const { name, email, password } = req.body;

      if (!name || !email || !password)
        return res.status(400).json({ error: "تمام فیلدها لازمند" });

      try {
        const [exists] = await pool.query(
          "SELECT id FROM users WHERE email=?",
          [email]
        );
        if (exists.length > 0)
          return res.status(400).json({ error: "ایمیل تکراری است" });

        const hashed = await bcrypt.hash(password, 10);

        await pool.query(
          "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'pending')",
          [name, email, hashed]
        );

        res.json({ message: "ثبت‌نام انجام شد. منتظر تایید مدیر باشید." });
      } catch (err) {
        res.status(500).json({ error: "خطا در ثبت‌نام" });
      }
    });

    // --------------------------------------
    // 🔐 ورود
    // --------------------------------------
    app.post("/api/login", async (req, res) => {
      const { email, password } = req.body;

      try {
        const [users] = await pool.query("SELECT * FROM users WHERE email=?", [
          email,
        ]);
        if (users.length === 0)
          return res.status(404).json({ error: "کاربر پیدا نشد" });

        const user = users[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match)
          return res.status(401).json({ error: "رمز عبور اشتباه است" });

        const token = jwt.sign(
          { id: user.id, role: user.role },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
          message: "ورود موفقیت‌آمیز",
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      } catch (err) {
        res.status(500).json({ error: "خطا در ورود" });
      }
    });

    // ============================
    app.put("/api/profile", auth, async (req, res) => {
      const { name, password } = req.body;

      if (!name || name.trim() === "") {
        return res.status(400).json({ error: "نام الزامی است" });
      }

      if (req.user.role === "admin") {
        // این مسیر نباید برای ادمین‌ها استفاده شود
        // فعلاً دست نمی‌زنیم تا معماری شما لطمه نخورد.
      }

      try {
        if (password && password.trim() !== "") {
          const hashed = await bcrypt.hash(password, 10);
          await pool.query("UPDATE users SET name=?, password=? WHERE id=?", [
            name,
            hashed,
            req.user.id,
          ]);
        } else {
          await pool.query("UPDATE users SET name=? WHERE id=?", [
            name,
            req.user.id,
          ]);
        }

        res.json({ message: "پروفایل با موفقیت بروزرسانی شد" });
      } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).json({ error: "خطا در بروزرسانی پروفایل" });
      }
    });

    // =========================================================
    // ✅ جلسه ۸: Borrow / Return (فقط اضافه شده — حذف نشده)
    // =========================================================

    // --------------------------------------
    // 🔁 Borrow Book (Member only)
    // --------------------------------------
    app.post("/api/borrow", auth, async (req, res) => {
      const { book_id } = req.body;

      // فقط member (اکانت تایید شده)
      if (req.user.role !== "member") {
        return res.status(403).json({ error: "حساب شما هنوز تایید نشده است" });
      }

      try {
        // بررسی موجودی کتاب
        const [[book]] = await pool.query(
          "SELECT id, available_copies FROM books WHERE id=?",
          [book_id]
        );

        if (!book) return res.status(404).json({ error: "کتاب یافت نشد" });

        if (book.available_copies <= 0) {
          return res.status(400).json({ error: "موجودی کتاب تمام شده است" });
        }

        // محدودیت ۳ امانت فعال
        const [[cnt]] = await pool.query(
          "SELECT COUNT(*) AS count FROM borrows WHERE member_id=? AND status='borrowed'",
          [req.user.id]
        );

        if (cnt.count >= 3) {
          return res
            .status(400)
            .json({ error: "حداکثر ۳ کتاب می‌توانید امانت بگیرید" });
        }

        // ثبت امانت
        await pool.query(
          "INSERT INTO borrows (book_id, member_id, borrow_date, status) VALUES (?, ?, NOW(), 'borrowed')",
          [book_id, req.user.id]
        );

        // کاهش موجودی
        await pool.query(
          "UPDATE books SET available_copies = available_copies - 1 WHERE id=?",
          [book_id]
        );

        res.json({ message: "کتاب با موفقیت امانت گرفته شد" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "خطا در امانت گرفتن کتاب" });
      }
    });

    // --------------------------------------
    // 📘 My Borrows (Member) - برای member-panel
    // --------------------------------------
    app.get("/api/my-borrows", auth, async (req, res) => {
      if (req.user.role !== "member") {
        return res.status(403).json({ error: "دسترسی غیرمجاز" });
      }

      try {
        const [rows] = await pool.query(
          `SELECT b.id, bk.title, b.borrow_date, b.return_date, b.status
           FROM borrows b
           JOIN books bk ON bk.id = b.book_id
           WHERE b.member_id = ?
           ORDER BY b.borrow_date DESC`,
          [req.user.id]
        );

        res.json(rows);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "خطا در دریافت امانت‌ها" });
      }
    });

    // --------------------------------------
    // 📋 Active Borrows (Admin) - برای admin-panel
    // --------------------------------------
    app.get("/api/borrows/active", auth, admin, async (req, res) => {
      try {
        const [rows] = await pool.query(
          `SELECT b.id, u.name AS member, bk.title, b.borrow_date
           FROM borrows b
           JOIN users u ON u.id = b.member_id
           JOIN books bk ON bk.id = b.book_id
           WHERE b.status='borrowed'
           ORDER BY b.borrow_date DESC`
        );
        res.json(rows);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "خطا در دریافت امانت‌های فعال" });
      }
    });

    // --------------------------------------
    // 🔄 Return Book (Admin)
    // --------------------------------------
    app.post("/api/return/:borrowId", auth, admin, async (req, res) => {
      const { borrowId } = req.params;

      try {
        const [[borrow]] = await pool.query(
          "SELECT book_id, status FROM borrows WHERE id=?",
          [borrowId]
        );

        if (!borrow) return res.status(404).json({ error: "امانت یافت نشد" });

        if (borrow.status !== "borrowed") {
          return res
            .status(400)
            .json({ error: "این امانت قبلاً بازگردانده شده است" });
        }

        // تغییر وضعیت + ثبت تاریخ بازگشت
        await pool.query(
          "UPDATE borrows SET status='returned', return_date=NOW() WHERE id=?",
          [borrowId]
        );

        // افزایش موجودی
        await pool.query(
          "UPDATE books SET available_copies = available_copies + 1 WHERE id=?",
          [borrow.book_id]
        );

        res.json({ message: "کتاب با موفقیت بازگردانده شد" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "خطا در بازگشت کتاب" });
      }
    });

    // سوابق امانت‌های تکمیل‌شده (برگشتی)
// سوابق امانت‌های تکمیل‌شده (برگشتی)
app.get("/api/borrows/history", auth, admin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        b.id,
        u.name AS member,
        bk.title,
        b.borrow_date,
        b.return_date
      FROM borrows b
      JOIN users u ON b.member_id = u.id
      JOIN books bk ON b.book_id = bk.id
      WHERE b.status = 'returned'
      ORDER BY b.return_date DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("Error loading borrow history:", err);
    res.status(500).json({ error: "خطا در دریافت سوابق امانت‌ها" });
  }
});


    // --------------------------------------
    // 🚀 اجرای سرور
    // --------------------------------------
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.log("❌ Database connection failed:", err);
  }
}

init();
