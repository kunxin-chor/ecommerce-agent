CREATE DATABASE ecommerce;

USE ecommerce;

-- Products table
CREATE TABLE products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  imageUrl VARCHAR(255) NOT NULL,
  description TEXT NOT NULL
);

-- Users table
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  salutation VARCHAR(10),
  country VARCHAR(50),
  created_at DATETIME DEFAULT NOW()
);

CREATE TABLE marketing_preferences (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  preference VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE user_marketing_preferences (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  preference_id INT UNSIGNED NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (preference_id) REFERENCES marketing_preferences(id) ON DELETE CASCADE
);

-- Cart Items table
CREATE TABLE cart_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Orders table
CREATE TABLE orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'completed', 'cancelled', 'shipping', 'processing') DEFAULT 'pending',
  checkout_session_id VARCHAR(255),
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order Items table
CREATE TABLE order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);