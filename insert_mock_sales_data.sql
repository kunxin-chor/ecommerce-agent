USE ecommerce;

-- ============================================================
-- 1. ADD LOW-STOCK PRODUCTS
-- ============================================================

INSERT INTO products
(category_id, name, brand, price, imageUrl, description, stock)
VALUES
(
    2,
    'DemoFuel Creatine Monohydrate',
    'DemoFuel',
    39.99,
    'https://example.com/images/creatine.png',
    'Creatine monohydrate powder for strength and exercise performance',
    8
);

SET @creatine_product_id = LAST_INSERT_ID();


INSERT INTO products
(category_id, name, brand, price, imageUrl, description, stock)
VALUES
(
    4,
    'DemoHealth Zinc + Vitamin C',
    'DemoHealth',
    9.99,
    'https://example.com/images/zinc-vitamin-c.png',
    'Zinc and vitamin C supplement for immune system support',
    3
);

SET @zinc_product_id = LAST_INSERT_ID();


-- ============================================================
-- 2. JANUARY 2026 ORDERS
-- ============================================================

-- Order: 2 x Whey + 1 x Fish Oil
-- 2(49.99) + 1(24.99) = 124.97

INSERT INTO orders
(user_id, total, status, checkout_session_id, created_at)
VALUES
(
    2,
    124.97,
    'completed',
    'cs_mock_20260105_001',
    '2026-01-05 10:30:00'
);

SET @jan_order_1 = LAST_INSERT_ID();

INSERT INTO order_items
(order_id, product_id, quantity)
VALUES
(@jan_order_1, 2, 2),
(@jan_order_1, 3, 1);


-- Order: 4 x Vitamin D3 K2
-- 4(19.99) = 79.96

INSERT INTO orders
(user_id, total, status, checkout_session_id, created_at)
VALUES
(
    3,
    79.96,
    'completed',
    'cs_mock_20260112_002',
    '2026-01-12 14:15:00'
);

SET @jan_order_2 = LAST_INSERT_ID();

INSERT INTO order_items
(order_id, product_id, quantity)
VALUES
(@jan_order_2, 4, 4);


-- Order: 2 x Probiotic + 1 x Melatonin
-- 2(34.99) + 1(14.99) = 84.97

INSERT INTO orders
(user_id, total, status, checkout_session_id, created_at)
VALUES
(
    4,
    84.97,
    'completed',
    'cs_mock_20260120_003',
    '2026-01-20 09:45:00'
);

SET @jan_order_3 = LAST_INSERT_ID();

INSERT INTO order_items
(order_id, product_id, quantity)
VALUES
(@jan_order_3, 5, 2),
(@jan_order_3, 6, 1);


-- ============================================================
-- 3. FEBRUARY 2026 ORDERS
-- ============================================================

-- Completed order containing both low-stock products
-- 3 x Creatine + 2 x Zinc
-- 3(39.99) + 2(9.99) = 139.95

INSERT INTO orders
(user_id, total, status, checkout_session_id, created_at)
VALUES
(
    2,
    139.95,
    'completed',
    'cs_mock_20260203_004',
    '2026-02-03 16:20:00'
);

SET @feb_order_1 = LAST_INSERT_ID();

INSERT INTO order_items
(order_id, product_id, quantity)
VALUES
(@feb_order_1, @creatine_product_id, 3),
(@feb_order_1, @zinc_product_id, 2);


-- Shipping order
-- Should NOT appear in completed-order tools

INSERT INTO orders
(user_id, total, status, checkout_session_id, created_at)
VALUES
(
    3,
    149.95,
    'shipping',
    'cs_mock_20260210_005',
    '2026-02-10 11:00:00'
);

SET @feb_shipping_order = LAST_INSERT_ID();

INSERT INTO order_items
(order_id, product_id, quantity)
VALUES
(@feb_shipping_order, 1, 5);


-- Cancelled order
-- Should NOT appear in completed-order tools

INSERT INTO orders
(user_id, total, status, checkout_session_id, created_at)
VALUES
(
    4,
    49.99,
    'cancelled',
    'cs_mock_20260214_006',
    '2026-02-14 18:30:00'
);

SET @feb_cancelled_order = LAST_INSERT_ID();

INSERT INTO order_items
(order_id, product_id, quantity)
VALUES
(@feb_cancelled_order, 2, 1);


-- Completed multi-product order
-- 1 x Multivitamin + 2 x D3 K2 + 1 x Creatine
-- 29.99 + 39.98 + 39.99 = 109.96

INSERT INTO orders
(user_id, total, status, checkout_session_id, created_at)
VALUES
(
    1,
    109.96,
    'completed',
    'cs_mock_20260220_007',
    '2026-02-20 13:10:00'
);

SET @feb_order_2 = LAST_INSERT_ID();

INSERT INTO order_items
(order_id, product_id, quantity)
VALUES
(@feb_order_2, 1, 1),
(@feb_order_2, 4, 2),
(@feb_order_2, @creatine_product_id, 1);


-- ============================================================
-- 4. MARCH 2026 ORDERS
-- ============================================================

-- Completed order
-- 1 x Zinc + 2 x Fish Oil
-- 9.99 + 49.98 = 59.97

INSERT INTO orders
(user_id, total, status, checkout_session_id, created_at)
VALUES
(
    3,
    59.97,
    'completed',
    'cs_mock_20260305_008',
    '2026-03-05 15:40:00'
);

SET @mar_order_1 = LAST_INSERT_ID();

INSERT INTO order_items
(order_id, product_id, quantity)
VALUES
(@mar_order_1, @zinc_product_id, 1),
(@mar_order_1, 3, 2);


-- Pending order
-- Should NOT appear in completed-order tools

INSERT INTO orders
(user_id, total, status, checkout_session_id, created_at)
VALUES
(
    4,
    39.99,
    'pending',
    'cs_mock_20260318_009',
    '2026-03-18 20:00:00'
);

SET @mar_pending_order = LAST_INSERT_ID();

INSERT INTO order_items
(order_id, product_id, quantity)
VALUES
(@mar_pending_order, @creatine_product_id, 1);