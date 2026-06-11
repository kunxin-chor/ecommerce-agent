USE ecommerce;

INSERT INTO products (name, price, imageUrl, description) VALUES
('Sleek Smartwatch', 199.99, 'https://picsum.photos/id/20/300/200', 'A modern smartwatch with fitness tracking and notifications'),
('Wireless Earbuds', 79.99, 'https://picsum.photos/id/1/300/200', 'Compact wireless earbuds with noise isolation and long battery life'),
('Portable Power Bank', 49.99, 'https://picsum.photos/id/26/300/200', 'High-capacity portable power bank for charging devices on the go'),
('HD Action Camera', 129.99, 'https://picsum.photos/id/96/300/200', 'Durable HD action camera for outdoor and adventure recording');

INSERT INTO marketing_preferences (id, preference) VALUES
(1, 'Email Marketing'),  -- Email Marketing
(2, 'SMS Marketing');    -- SMS Marketing
