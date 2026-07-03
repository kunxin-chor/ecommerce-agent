USE ecommerce;

-- Categories
INSERT INTO categories (name) VALUES
('Vitamins & Minerals'),
('Sports Nutrition'),
('Heart Health'),
('Bone & Immune'),
('Digestive Health'),
('Sleep Support');

-- Products (with category_id)
INSERT INTO products (category_id, name, brand, price, imageUrl, description, stock) VALUES
(1, 'Nature Made Multi for Him', 'Nature Made', 29.99, 'https://www.naturemade.com/cdn/shop/files/NM1789PK001929MULTIFORHIM_5A007225ccfront_1500x.png?v=1756999774', 'Daily multivitamin with 25+ vitamins and minerals for overall health and wellness', 150),
(2, 'Gold Standard 100% Whey Protein', 'Optimum Nutrition', 49.99, 'https://www.optimumnutrition.com/cdn/shop/files/US_GSW_5LB_FrenchVanCr_FOP.png?v=1781190678&width=1400', 'High-quality protein powder for muscle building and post-workout recovery', 100),
(3, 'Nature Made Fish Oil 1200mg', 'Nature Made', 24.99, 'https://www.naturemade.com/cdn/shop/files/NM1328PK000745FISHOIL_5A009400ccfront_1500x.png?v=1695678265', 'Heart-healthy omega-3 fatty acids EPA and DHA for cardiovascular support', 200),
(4, 'Sports Research Vitamin D3 K2', 'Sports Research', 19.99, 'https://www.sportsresearch.com/_next/image?url=https%3A%2F%2Fcdn.shopify.com%2Fs%2Ffiles%2F1%2F1813%2F6377%2Ffiles%2Fsr_web_render_fg218_d3_k2_front_medium_8bf76316-42d5-493f-ab5e-5aadfb7cc797.png%3Fv%3D1778270249&w=1920&q=75', 'Essential vitamins for bone health and immune system support', 180),
(5, 'Culturelle Daily Probiotic', 'Culturelle', 34.99, 'https://culturelle.com/cdn/shop/files/cul-DDH-50-display.webp?crop=center&height=1200&v=1778762170&width=1200', '50 billion CFU probiotic blend for digestive health and immunity', 120),
(6, 'Natrol Melatonin 5mg', 'Natrol', 14.99, 'https://www.natrol.com/cdn/shop/files/4837.931_Melatonin_5mg_TR_100ct_150ccLabel_Front_DS.png?v=1745966369&width=700', 'Natural sleep aid to help regulate sleep cycle and improve rest quality', 250);

-- Tags
INSERT INTO tags (name) VALUES
('adult'),
('multivitamin'),
('athlete'),
('protein'),
('cardio'),
('omega-3'),
('immune'),
('bone'),
('probiotic'),
('gut'),
('sleep'),
('melatonin');

-- Product-Tag associations
INSERT INTO product_tags (product_id, tag_id) VALUES
(1, 1), (1, 2),        -- Multivitamin: adult, multivitamin
(2, 3), (2, 4),        -- Whey: athlete, protein
(3, 5), (3, 6),        -- Fish Oil: cardio, omega-3
(4, 7), (4, 8),        -- D3+K2: immune, bone
(5, 9), (5, 10), (5, 7), -- Probiotic: probiotic, gut, immune
(6, 11), (6, 12);      -- Melatonin: sleep, melatonin

INSERT INTO users (name, email, password, salutation, country, role) VALUES
('Admin User', 'admin@example.com', '$2b$10$wfKRyY4X//rui5Zye9wRGeJPaQg2WUu/FMSzvudlEXx9Rd.rsJv66', 'Mr', 'USA', 'admin'),  -- password: admin123
('John Doe', 'john@example.com', '$2b$10$RyoQaDS.vDwi7IPiW6TitO9m3qZft/hlvfAhdnk/IStkSmYzwGJlO', 'Mr', 'USA', 'user'),      -- password: user123
('Jane Smith', 'jane@example.com', '$2b$10$RyoQaDS.vDwi7IPiW6TitO9m3qZft/hlvfAhdnk/IStkSmYzwGJlO', 'Ms', 'UK', 'user'),     -- password: user123
('Bob Johnson', 'bob@example.com', '$2b$10$RyoQaDS.vDwi7IPiW6TitO9m3qZft/hlvfAhdnk/IStkSmYzwGJlO', 'Mr', 'Canada', 'user'); -- password: user123

INSERT INTO marketing_preferences (id, preference) VALUES
(1, 'Email Marketing'),
(2, 'SMS Marketing');

INSERT INTO user_marketing_preferences (user_id, preference_id) VALUES
(1, 1),
(1, 2),
(2, 1),
(3, 2);

INSERT INTO cart_items (user_id, product_id, quantity) VALUES
(1, 1, 2),
(1, 2, 1),
(2, 3, 3),
(3, 5, 1);

INSERT INTO orders (user_id, total, status, checkout_session_id) VALUES
(1, 109.97, 'completed', 'cs_test_1234567890'),
(2, 74.97, 'shipping', 'cs_test_0987654321'),
(3, 34.99, 'pending', 'cs_test_1122334455');

INSERT INTO order_items (order_id, product_id, quantity) VALUES
(1, 1, 2),
(1, 2, 1),
(2, 3, 3),
(3, 5, 1);
