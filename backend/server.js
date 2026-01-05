import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";

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
//-----------------------عکس برای کتاب--------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/books");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});
app.use("/uploads", express.static("uploads"));
// =========================
// ویرایش کتاب + عکس اختیاری
// =========================
app.put(
  "/api/books/:id",
  auth,
  admin,
  upload.single("image"),
  async (req, res) => {

    const {
      title,
      author,
      category,
      isbn,
      publication_year,
      total_copies,
      shelf_number
    } = req.body;

    // اگر عکس جدید ارسال شده باشد
    const imagePath = req.file
      ? `/uploads/books/${req.file.filename}`
      : null;

    // ساخت کوئری داینامیک
    let sql = `
      UPDATE books SET
        title=?,
        author=?,
        category=?,
        isbn=?,
        publication_year=?,
        total_copies=?,
        shelf_number=?
        ${imagePath ? ", image=?" : ""}
      WHERE id=?
    `;

    const params = [
      title,
      author,
      category,
      isbn,
      publication_year,
      total_copies,
      shelf_number
    ];

    if (imagePath) params.push(imagePath);
    params.push(req.params.id);

    await pool.query(sql, params);

    res.json({ message: "کتاب با موفقیت ویرایش شد" });
  }
);


//----------------//
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
app.post(
  "/api/books",
  auth,
  admin,
  upload.single("image"),   
  async (req, res) => {
    try {
      const { 
        title, 
        author, 
        category, 
        isbn, 
        publication_year, 
        total_copies, 
        shelf_number 
      } = req.body;

      // اعتبارسنجی اولیه
      if (!title || !author || !publication_year || !total_copies) {
        return res.status(400).json({
          error: "لطفاً فیلدهای الزامی (عنوان، نویسنده، سال، تعداد کل) را پر کنید."
        });
      }

      // موجودی اولیه
      const available_copies = parseInt(total_copies);

      // مسیر تصویر (اختیاری)
      const imagePath = req.file
        ? `/uploads/books/${req.file.filename}`
        : null;

      const [result] = await pool.query(
        `INSERT INTO books 
         (title, author, category, isbn, publication_year, total_copies, available_copies, shelf_number, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          author,
          category,
          isbn,
          parseInt(publication_year),
          parseInt(total_copies),
          available_copies,
          shelf_number,
          imagePath
        ]
      );

      res.status(201).json({
        id: result.insertId,
        message: "کتاب با موفقیت اضافه شد."
      });

    } catch (err) {
      console.error("Error adding book:", err);
      res.status(500).json({
        error: "خطای سرور در افزودن کتاب."
      });
    }
  }
);


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
    // server.js - مسیر PUT اصلاح شده
app.put("/api/books/:id", auth, admin, async (req, res) => {
    const bookId = req.params.id;
    // دریافت تمام فیلدها از کلاینت
    const { 
        title, 
        author, 
        category, 
        isbn, 
        publication_year, 
        total_copies, 
        shelf_number 
    } = req.body;

    try {
        // 1. بازیابی اطلاعات فعلی برای محاسبه available_copies
        const [currentBookRows] = await pool.query("SELECT total_copies, available_copies FROM books WHERE id = ?", [bookId]);
        if (currentBookRows.length === 0) {
            return res.status(404).json({ error: "کتابی با این شناسه پیدا نشد." });
        }
        const currentBook = currentBookRows[0];
        
        // 2. محاسبه موجودی جدید:
        const borrowedCopies = currentBook.total_copies - currentBook.available_copies;
        const newTotalCopies = parseInt(total_copies);
        let newAvailableCopies = newTotalCopies - borrowedCopies;
        
        // جلوگیری از موجودی کمتر از تعداد امانت رفته
        if (newAvailableCopies < 0) {
            return res.status(400).json({ error: `تعداد کل نسخه‌ها (${newTotalCopies}) نمی‌تواند کمتر از تعداد امانت داده شده (${borrowedCopies} عدد) باشد.` });
        }
        
        // 3. اجرای کوئری UPDATE
        const [result] = await pool.query(
            `UPDATE books SET 
                title=?, 
                author=?, 
                category=?, 
                isbn=?, 
                publication_year=?, 
                total_copies=?, 
                available_copies=?, 
                shelf_number=? 
            WHERE id=?`,
            [
                title,
                author,
                category,
                isbn,
                parseInt(publication_year),
                newTotalCopies,
                newAvailableCopies, // موجودی محاسبه شده
                shelf_number,
                bookId,
            ]
        );
        
        if (result.affectedRows === 0) {
           return res.status(404).json({ error: "کتاب برای ویرایش پیدا نشد." });
        }

        res.json({ message: "کتاب با موفقیت ویرایش شد" });
    } catch (err) {
        console.error("خطای ویرایش سرور:", err);
        res.status(500).json({ error: "خطا در ویرایش: لطفاً لاگ سرور را بررسی کنید (SQL Error)." });
    }
});
// دریافت لیست کامل کتاب‌ها (برای پنل ادمین)
app.get("/api/admin/books", auth, admin, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM books ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching admin books list:", err);
    res.status(500).json({ error: "خطا در بارگذاری لیست کتاب‌ها" });
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
    // 🔁 Borrow Book (Member only)
    // =========================================================
// 🔁 Borrow Book (Member only)
// =========================================================
app.post("/api/borrow", auth, async (req, res) => {
  const { book_id } = req.body;

  // ⛔ فقط کاربران تایید شده (member) اجازه امانت دارند
  if (req.user.role !== "member") {
    return res.status(403).json({
      error: "حساب شما هنوز تایید نشده است"
    });
  }

  try {
    // 📌 بررسی وجود کتاب و موجودی آن
    const [[book]] = await pool.query(
      "SELECT id, available_copies FROM books WHERE id=?",
      [book_id]
    );

    // اگر کتاب وجود نداشت
    if (!book) {
      return res.status(404).json({ error: "کتاب یافت نشد" });
    }

    // اگر موجودی صفر بود
    if (book.available_copies <= 0) {
      return res.status(400).json({ error: "موجودی کتاب تمام شده است" });
    }

    // 📌 محدودیت: هر کاربر حداکثر ۳ امانت فعال
    const [[cnt]] = await pool.query(
      "SELECT COUNT(*) AS count FROM borrows WHERE member_id=? AND status='borrowed'",
      [req.user.id]
    );

    if (cnt.count >= 3) {
      return res.status(400).json({
        error: "حداکثر ۳ کتاب می‌توانید امانت بگیرید"
      });
    }

    // =================================================
    // ⭐ محاسبه تاریخ امانت و تاریخ مجاز بازگشت
    // =================================================

    // تاریخ امانت (الان)
    const borrowDate = new Date();

    // تاریخ بازگشت = ۷ روز بعد از تاریخ امانت
const dueDate = new Date();
dueDate.setDate(dueDate.getDate() + 7);



    // =================================================
    // 📝 ثبت امانت در دیتابیس
    // =================================================
    await pool.query(
      `INSERT INTO borrows 
       (book_id, member_id, borrow_date, due_date, status)
       VALUES (?, ?, ?, ?, 'borrowed')`,
      [
        book_id,         // شناسه کتاب
        req.user.id,     // شناسه عضو
        borrowDate,      // تاریخ امانت
        dueDate          // تاریخ مجاز بازگشت
      ]
    );

    // =================================================
    // 📉 کاهش موجودی کتاب
    // =================================================
    await pool.query(
      "UPDATE books SET available_copies = available_copies - 1 WHERE id=?",
      [book_id]
    );

    // =================================================
    // 📤 ارسال پاسخ به کاربر
    // =================================================
    res.json({
      message: "کتاب با موفقیت امانت گرفته شد",
      // ارسال تاریخ برگشت برای نمایش در رابط کاربری
      due_date: dueDate.toISOString().split("T")[0]
    });

  } catch (err) {
    console.error("Borrow error:", err);
    res.status(500).json({
      error: "خطا در امانت گرفتن کتاب"
    });
  }
});

    // --------------------------------------
    // 📘 My Borrows (Member) - برای member-panel
    // --------------------------------------
    // 🔁 امانت‌های کاربر (پنل کاربر)
app.get("/api/my-borrows", auth, async (req, res) => {
  if (req.user.role !== "member") {
    return res.status(403).json({ error: "دسترسی غیرمجاز" });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        b.id,
        bk.title,
        b.borrow_date,
        b.due_date,        -- ⭐ تاریخ مجاز بازگشت
        b.return_date,
        b.status
      FROM borrows b
      JOIN books bk ON bk.id = b.book_id
      WHERE b.member_id = ?
      ORDER BY b.borrow_date DESC
      `,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطا در دریافت امانت‌ها" });
  }
});


    // --------------------------------------
// 📋 Active Borrows (Admin) - اصلاح شده
// --------------------------------------
app.get("/api/borrows/active", auth, admin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        b.id,
        u.name AS member,
        bk.title,
        b.borrow_date,
        b.due_date,       
        b.return_date,
        b.status
      FROM borrows b
      JOIN users u ON u.id = b.member_id
      JOIN books bk ON bk.id = b.book_id
      WHERE b.status = 'borrowed'
      ORDER BY b.borrow_date DESC
      `
    );

    res.json(rows);

  } catch (err) {
    console.error("Error loading active borrows:", err);
    res.status(500).json({ error: "خطا در دریافت امانت‌های فعال" });
  }
});


    // --------------------------------------
    // 🔄 Return Book (Admin)
    // --------------------------------------
    app.post("/api/return/:borrowId", auth, admin, async (req, res) => {

  const FINE_PER_DAY = 50000; // مبلغ جریمه روزانه (تومان)
  const { borrowId } = req.params;

  try {
    // 1️⃣ دریافت اطلاعات امانت
    const [[borrow]] = await pool.query(
      `SELECT id, book_id, member_id, due_date, status
       FROM borrows
       WHERE id=?`,
      [borrowId]
    );

    if (!borrow) {
      return res.status(404).json({ error: "امانت یافت نشد" });
    }

    if (borrow.status !== "borrowed") {
      return res.status(400).json({ error: "این امانت قبلاً بسته شده است" });
    }

    // 2️⃣ محاسبه دیرکرد
    let fine = 0;

    if (borrow.due_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dueDate = new Date(borrow.due_date);
      dueDate.setHours(0, 0, 0, 0);

      if (today > dueDate) {
        const diffTime = today.getTime() - dueDate.getTime();
        const lateDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        fine = lateDays * FINE_PER_DAY;
      }
    }

    // 3️⃣ ثبت بازگشت کتاب
    await pool.query(
      `UPDATE borrows
       SET status='returned', return_date=NOW()
       WHERE id=?`,
      [borrowId]
    );

    // 4️⃣ افزایش موجودی کتاب
    await pool.query(
      `UPDATE books
       SET available_copies = available_copies + 1
       WHERE id=?`,
      [borrow.book_id]
    );

    // 5️⃣ کسر جریمه از کیف پول (حتی اگر منفی شود)
    if (fine > 0) {
      await pool.query(
        `UPDATE users
         SET wallet = wallet - ?
         WHERE id=?`,
        [fine, borrow.member_id]
      );
    }

    res.json({
      message: "کتاب با موفقیت بازگردانده شد",
      fine: fine
    });

  } catch (err) {
    console.error("Return error:", err);
    res.status(500).json({ error: "خطا در ثبت بازگشت کتاب" });
  }
});


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
// 🔍 جست‌وجوی زنده کتاب‌ها (Autocomplete)
app.get("/api/search/books", async (req, res) => {
  const q = req.query.q;
  if (!q || q.trim().length < 2) {
    return res.json([]);
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, title, author 
       FROM books
       WHERE title LIKE ? 
          OR author LIKE ? 
          OR isbn LIKE ?
       LIMIT 8`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطا در جست‌وجو" });
  }
});

// =========================
// 💰 Wallet - Member
// =========================
app.get("/api/wallet", auth, async (req, res) => {

  // فقط اعضا
  if (req.user.role !== "member") {
    return res.status(403).json({ error: "دسترسی غیرمجاز" });
  }

  try {
    const [[user]] = await pool.query(
      "SELECT wallet FROM users WHERE id=?",
      [req.user.id]
    );

    res.json({
      wallet: user.wallet
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطا در دریافت کیف پول" });
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
