USE ecommerce;

-- Drop the old standalone chat_messages table if it exists
DROP TABLE IF EXISTS chat_messages;

-- Parent table: each row is one conversation thread
CREATE TABLE chat_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Child table: each row is one message within a session
CREATE TABLE chat_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NOT NULL,
  role ENUM('human', 'ai') NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);