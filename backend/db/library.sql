CREATE DATABASE IF NOT EXISTS library_db;
USE library_db;

-- جدول کاربران
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- جدول کتاب‌ها
CREATE TABLE books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255),
  isbn VARCHAR(20) UNIQUE,
  publication_year INT,
  total_copies INT DEFAULT 0,
  available_copies INT DEFAULT 0,
  shelf_number VARCHAR(20)
);

-- جدول اعضا
CREATE TABLE members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  membership_number VARCHAR(50) NOT NULL UNIQUE,
  expiry_date DATE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- جدول امانت‌ها
CREATE TABLE borrows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  member_id INT NOT NULL,
  borrow_date DATE NOT NULL,
  return_date DATE,
  status VARCHAR(20) DEFAULT 'borrowed',
  fine DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- داده تستی
INSERT INTO users (name,email,password,role)
VALUES ('Admin','admin@example.com','123456','admin');

INSERT INTO books (title,author,isbn,publication_year,total_copies,available_copies,shelf_number)
VALUES ('1984','George Orwell','9780451524935',1949,5,5,'A-12');
