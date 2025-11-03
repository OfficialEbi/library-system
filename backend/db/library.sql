
CREATE DATABASE IF NOT EXISTS library_db CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE library_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'member', 'pending') NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  membership_number VARCHAR(50) NOT NULL UNIQUE,
  expiry_date DATE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255),
  category VARCHAR(100), -- ✅ ستون جدید دسته‌بندی
  isbn VARCHAR(20) UNIQUE,
  publication_year INT,
  total_copies INT DEFAULT 0,
  available_copies INT DEFAULT 0,
  shelf_number VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS borrows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  member_id INT NOT NULL,
  borrow_date DATE NOT NULL,
  return_date DATE,
  status ENUM('borrowed', 'returned', 'overdue') DEFAULT 'borrowed',
  fine DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

--  داده تستی اولیه

-- مدیر اصلی سامانه
INSERT INTO users (name, email, password, role)
VALUES ('Admin', 'admin@example.com', '123456', 'admin');

-- کاربر عادی (در انتظار تأیید)
INSERT INTO users (name, email, password, role)
VALUES ('Ali Rezayi', 'ali@example.com', '123456', 'pending');

INSERT INTO books (title, author, category, isbn, publication_year, total_copies, available_copies, shelf_number)
VALUES
('1984', 'George Orwell', 'رمان اجتماعی', '9780451524935', 1949, 5, 5, 'A-12'),
('Clean Code', 'Robert C. Martin', 'برنامه‌نویسی', '9780132350884', 2008, 3, 3, 'B-07'),
('The Alchemist', 'Paulo Coelho', 'ادبیات', '9780062315007', 1988, 4, 4, 'A-09');
