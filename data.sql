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

-- Sample reviews
SET @empty_embedding = VEC_FromText(CONCAT('[', REPEAT('0,', 3071), '0]'));

INSERT INTO reviews (product_id, title, review_text, review_date, rating, embedding) VALUES
(1, 'Great daily multivitamin', 'I have been taking Nature Made Multi for Him for about six months now and I genuinely notice a difference in my energy levels throughout the day. The tablet is easy to swallow and does not cause any stomach upset when taken with breakfast. I appreciate that it does not contain iron since most men do not need extra iron supplementation. The USP verification gives me confidence that what is on the label is actually in the pill. Would definitely recommend to any man looking for a solid all-in-one daily vitamin.', '2026-01-15', 5, @empty_embedding),
(1, 'Decent multivitamin but nothing special', 'This is a reliable multivitamin that covers all the basics. I take it every morning with my coffee and have not had any issues with it. The vitamin D content is higher than most which is a plus since many people are deficient. My only complaint is that the tablet is a bit large compared to other brands I have tried. The price is reasonable for what you get and the Nature Made brand has a good reputation for quality. Three stars because I have not noticed any dramatic changes but it seems to be doing its job quietly.', '2026-02-20', 3, @empty_embedding),
(1, 'My go-to multivitamin', 'Switched to this from a more expensive brand and honestly cannot tell the difference in how I feel. The B vitamin complex in this formula really does seem to help with afternoon energy slumps. I like that it is gluten free and does not have artificial colors. Been using Nature Made products for years and they have never let me down. Will keep buying.', '2026-03-10', 4, @empty_embedding),
(2, 'Best tasting protein powder I have tried', 'The French Vanilla Creme flavor of Gold Standard Whey is genuinely delicious. It mixes incredibly well with just a shaker bottle and water with no clumps whatsoever. Each serving gives you 24 grams of protein which is exactly what I need post workout. I have tried many protein powders over the years and this one consistently delivers on taste and mixability. The macros are clean with low fat and carbs which suits my cutting phase perfectly. Highly recommend to anyone serious about their training.', '2026-01-05', 5, @empty_embedding),
(2, 'Good protein but expensive', 'The quality of Gold Standard Whey is undeniable. The amino acid profile is excellent with plenty of leucine to trigger muscle protein synthesis. I use it after every lifting session and my recovery has noticeably improved since switching to this from a cheaper brand. My only issue is the price point which has gone up significantly. For the quality you are getting it is worth it but it does sting the wallet. The 5 pound bag lasts me about six weeks training five days a week.', '2026-02-14', 4, @empty_embedding),
(2, 'Solid product but caused some digestive issues', 'Great protein in terms of quality and taste however I did experience some bloating when I first started using it. This seems to have settled down after a few weeks which I have heard is common when introducing whey protein. The Aminogen enzyme blend they include does seem to help with digestion compared to other whey products I have used. Mixes well and tastes good. Would give five stars if not for the initial digestive adjustment period.', '2026-03-22', 3, @empty_embedding),
(3, 'No fishy burps and great value', 'I was hesitant to try fish oil because of the infamous fishy burp problem but these softgels have been completely fine for me. I take mine with dinner and have had zero issues. My doctor recommended omega-3 supplements for my triglyceride levels and after three months my numbers have improved noticeably. The softgels are a good size and easy to swallow. Nature Made is a trusted brand and the USP verification means I know I am getting what the label says.', '2026-01-28', 5, @empty_embedding),
(3, 'Good omega-3 supplement', 'Been taking these for about four months as part of a heart health regimen recommended by my cardiologist. The EPA and DHA content per serving is good value compared to other brands. I store mine in the refrigerator as recommended which seems to keep them fresh. The only minor issue is that the softgels can stick together in warm weather but this is common with fish oil products. Overall a solid choice for omega-3 supplementation.', '2026-02-08', 4, @empty_embedding),
(3, 'Helps with joint pain', 'I started taking fish oil specifically for joint inflammation in my knees and after about six weeks I noticed a real reduction in morning stiffness. The anti-inflammatory properties of EPA are well documented and I am a believer now. These are affordable, easy to find, and from a reputable brand. My only wish is that the DHA content was slightly higher but for the price this is excellent value.', '2026-04-01', 4, @empty_embedding),
(4, 'Finally a D3 supplement with K2 included', 'I have been looking for a high quality D3 and K2 combination for a long time and this one delivers. The MK-7 form of K2 has the longest half-life which means better sustained activity in the body. The coconut oil base is a smart addition since D3 is fat soluble and needs dietary fat for proper absorption. My vitamin D blood levels have risen significantly since starting this three months ago. The capsule is small and easy to take. Excellent product from Sports Research.', '2026-01-20', 5, @empty_embedding),
(4, 'Great combination but high D3 dose', 'The product quality is excellent and I appreciate the synergy between D3 and K2. However I want to flag that 5000 IU of D3 is a pharmacological dose not a nutritional one. If you are already taking other supplements with D3 or spend significant time outdoors you should get your blood levels tested before using this regularly. That said for people who are deficient this combination is very effective. The coconut oil base definitely improves absorption compared to dry capsules I have tried before.', '2026-03-05', 4, @empty_embedding),
(4, 'Noticed improvement in mood and energy', 'I was severely deficient in vitamin D according to my blood work and started this supplement on my doctors recommendation. Within about six weeks I noticed a significant improvement in my mood and energy levels which is consistent with what the research says about vitamin D deficiency. The K2 component is important for directing calcium properly and I like that Sports Research has included it. Will continue taking this long term with periodic blood monitoring.', '2026-04-15', 5, @empty_embedding),
(5, 'Transformed my digestive health', 'I have struggled with IBS for years and have tried countless probiotic supplements with mixed results. Culturelle has been a game changer. Within two weeks of starting I noticed significantly less bloating and my bowel movements became much more regular. The LGG strain is the most studied probiotic in the world and it shows. The delayed release capsule ensures the bacteria survive stomach acid which is critical for efficacy. I have now been taking this for four months and the improvement has been sustained.', '2026-01-12', 5, @empty_embedding),
(5, 'Good probiotic but takes time to work', 'I started Culturelle after a course of antibiotics wiped out my gut bacteria. It took about three weeks before I started noticing improvements in my digestion. The 50 billion CFU count is generous and the multiple strains cover different aspects of gut health. I appreciate that it is shelf stable and does not require refrigeration which makes travel easy. The prebiotic inulin is a nice addition to feed the probiotic bacteria. Would recommend to anyone recovering from antibiotic use.', '2026-02-25', 4, @empty_embedding),
(5, 'Helped with immunity not just digestion', 'I started taking Culturelle primarily for digestive health but an unexpected benefit has been fewer colds this winter. The connection between gut health and immune function is real and this product seems to support both. No side effects whatsoever and the vegetarian capsule suits my diet. The price is reasonable for the CFU count you are getting. I now recommend this to family members as my go-to probiotic recommendation.', '2026-03-18', 5, @empty_embedding),
(6, 'Finally sleeping through the night', 'I have been a chronic insomniac for years and have tried everything. Natrol Melatonin 5mg time release has genuinely helped me sleep through the night without waking up at 3am. The time release mechanism is the key difference compared to standard melatonin which I found wore off too quickly. I take it 30 minutes before bed and am usually asleep within 20 minutes. No grogginess in the morning which was a problem with prescription sleep aids I tried in the past.', '2026-01-08', 5, @empty_embedding),
(6, 'Works well for jet lag', 'I travel internationally for work and melatonin is essential for resetting my body clock. The 5mg time release formula helps me stay asleep through the night in a new time zone rather than just falling asleep quickly. I have tried other melatonin products but the Natrol time release formulation gives me the most natural feeling sleep. Non-habit forming which is important since I use it frequently. Great product for frequent travelers.', '2026-02-16', 4, @empty_embedding),
(6, 'Effective but 5mg might be too much for some', 'This product works very well for sleep but I want to note that the 5mg dose is quite high. Research suggests that much lower doses of 0.5 to 1mg are often equally effective for most people. I find that 5mg leaves me feeling slightly groggy the next morning if I do not get at least 8 hours of sleep. That said the time release mechanism is excellent and for people with significant insomnia this dose may be appropriate. Consider cutting the tablet in half if you are sensitive to melatonin.', '2026-03-30', 3, @empty_embedding);

-- Additional low-stock products
INSERT INTO products (category_id, name, brand, price, imageUrl, description, stock) VALUES
(2, 'DemoFuel Creatine Monohydrate', 'DemoFuel', 39.99, 'https://example.com/images/creatine.png', 'Creatine monohydrate powder for strength and exercise performance', 8);
SET @creatine_product_id = LAST_INSERT_ID();

INSERT INTO products (category_id, name, brand, price, imageUrl, description, stock) VALUES
(4, 'DemoHealth Zinc + Vitamin C', 'DemoHealth', 9.99, 'https://example.com/images/zinc-vitamin-c.png', 'Zinc and vitamin C supplement for immune system support', 3);
SET @zinc_product_id = LAST_INSERT_ID();

-- Mock sales orders
INSERT INTO orders (user_id, total, status, checkout_session_id, created_at) VALUES
(2, 124.97, 'completed', 'cs_mock_20260105_001', '2026-01-05 10:30:00');
SET @jan_order_1 = LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity) VALUES
(@jan_order_1, 2, 2), (@jan_order_1, 3, 1);

INSERT INTO orders (user_id, total, status, checkout_session_id, created_at) VALUES
(3, 79.96, 'completed', 'cs_mock_20260112_002', '2026-01-12 14:15:00');
SET @jan_order_2 = LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity) VALUES
(@jan_order_2, 4, 4);

INSERT INTO orders (user_id, total, status, checkout_session_id, created_at) VALUES
(4, 84.97, 'completed', 'cs_mock_20260120_003', '2026-01-20 09:45:00');
SET @jan_order_3 = LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity) VALUES
(@jan_order_3, 5, 2), (@jan_order_3, 6, 1);

INSERT INTO orders (user_id, total, status, checkout_session_id, created_at) VALUES
(2, 139.95, 'completed', 'cs_mock_20260203_004', '2026-02-03 16:20:00');
SET @feb_order_1 = LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity) VALUES
(@feb_order_1, @creatine_product_id, 3), (@feb_order_1, @zinc_product_id, 2);

INSERT INTO orders (user_id, total, status, checkout_session_id, created_at) VALUES
(3, 149.95, 'shipping', 'cs_mock_20260210_005', '2026-02-10 11:00:00');
SET @feb_shipping_order = LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity) VALUES
(@feb_shipping_order, 1, 5);

INSERT INTO orders (user_id, total, status, checkout_session_id, created_at) VALUES
(4, 49.99, 'cancelled', 'cs_mock_20260214_006', '2026-02-14 18:30:00');
SET @feb_cancelled_order = LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity) VALUES
(@feb_cancelled_order, 2, 1);

INSERT INTO orders (user_id, total, status, checkout_session_id, created_at) VALUES
(1, 109.96, 'completed', 'cs_mock_20260220_007', '2026-02-20 13:10:00');
SET @feb_order_2 = LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity) VALUES
(@feb_order_2, 1, 1), (@feb_order_2, 4, 2), (@feb_order_2, @creatine_product_id, 1);

INSERT INTO orders (user_id, total, status, checkout_session_id, created_at) VALUES
(3, 59.97, 'completed', 'cs_mock_20260305_008', '2026-03-05 15:40:00');
SET @mar_order_1 = LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity) VALUES
(@mar_order_1, @zinc_product_id, 1), (@mar_order_1, 3, 2);

INSERT INTO orders (user_id, total, status, checkout_session_id, created_at) VALUES
(4, 39.99, 'pending', 'cs_mock_20260318_009', '2026-03-18 20:00:00');
SET @mar_pending_order = LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity) VALUES
(@mar_pending_order, @creatine_product_id, 1);
