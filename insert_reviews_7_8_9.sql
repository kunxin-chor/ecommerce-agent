USE ecommerce;

SET @empty_embedding = VEC_FromText(CONCAT('[', REPEAT('0,', 3071), '0]'));

INSERT INTO reviews (product_id, title, review_text, review_date, rating, embedding) VALUES
-- Product 7: Gold Standard 100% Whey Double Rich Chocolate (Optimum Nutrition) - mostly positive
(7, 'Best chocolate protein I have tried', 'Rich, chocolatey, and mixes smooth with just a shaker bottle. This has become my go-to post-workout shake.', '2026-01-04', 5, @empty_embedding),
(7, 'Tastes like a milkshake', 'Hard to believe this is a protein powder and not dessert. Blends great with almond milk and ice.', '2026-01-12', 5, @empty_embedding),
(7, 'Great macros for cutting', '24g protein with low sugar and fat, exactly what I need to hit my numbers during a cut.', '2026-01-20', 5, @empty_embedding),
(7, 'No more chalky aftertaste', 'Switched from a cheaper brand and the difference in taste and mixability is night and day.', '2026-01-28', 4, @empty_embedding),
(7, 'Recovery feels faster', 'Soreness after leg day has noticeably improved since I started taking this daily.', '2026-02-05', 5, @empty_embedding),
(7, 'Reliable quality every tub', 'Been buying this for over a year and every tub tastes consistent and mixes well.', '2026-02-13', 5, @empty_embedding),
(7, 'Kids even like the taste', 'My teenager steals scoops for his smoothies because he loves the chocolate flavor.', '2026-02-21', 4, @empty_embedding),
(7, 'Good value for the quality', 'Price crept up but the amino profile and taste still make it worth it over cheaper alternatives.', '2026-03-01', 4, @empty_embedding),
(7, 'Perfect with just water', 'Do not even need milk, tastes rich and satisfying blended with plain water and ice.', '2026-03-09', 5, @empty_embedding),
(7, 'Helped me hit my protein goals', 'Adding a scoop to oatmeal or coffee has made hitting my daily protein target so much easier.', '2026-03-17', 5, @empty_embedding),
(7, 'Smooth texture, no clumps', 'Shakes up smooth even in a plain bottle with no blender ball needed.', '2026-03-25', 4, @empty_embedding),
(7, 'A bit sweet for my taste', 'Good flavor overall but a little too sweet for me, I usually cut it with extra water.', '2026-04-02', 3, @empty_embedding),
(7, 'Recent batch tasted off', 'Most tubs are great but one batch had a strange aftertaste that was not like the usual flavor.', '2026-04-10', 2, @empty_embedding),
(7, 'Caused some bloating', 'Love the taste but my stomach gets bloated if I use a full scoop on an empty stomach.', '2026-04-18', 2, @empty_embedding),
(7, 'Great taste, wish it was cheaper', 'No complaints about quality, just wish the price had not gone up so much recently.', '2026-04-26', 4, @empty_embedding),

-- Product 8: DemoFuel Creatine Monohydrate (DemoFuel) - middling, mixed reviews
(8, 'Does what it says', 'Standard creatine monohydrate, nothing fancy but it gets the job done for strength gains.', '2026-01-06', 4, @empty_embedding),
(8, 'Noticed a small strength bump', 'After the loading phase I noticed a modest increase in my lifting numbers, nothing dramatic.', '2026-01-14', 3, @empty_embedding),
(8, 'Mixes okay, some grit', 'Dissolves mostly fine in water but there is always a bit of grit left at the bottom of the glass.', '2026-01-22', 3, @empty_embedding),
(8, 'Caused some water retention', 'Feel a bit puffier since starting this, which I know is common with creatine but still annoying.', '2026-01-30', 3, @empty_embedding),
(8, 'Unflavored is truly flavorless', 'Appreciate that it has no taste, makes it easy to add to any drink without ruining the flavor.', '2026-02-07', 4, @empty_embedding),
(8, 'Stomach discomfort at first', 'Had some cramping the first week before my body adjusted to the daily dose.', '2026-02-15', 2, @empty_embedding),
(8, 'Average product, average results', 'Works as expected but I did not notice anything that sets it apart from cheaper creatine brands.', '2026-02-23', 3, @empty_embedding),
(8, 'Packaging is flimsy', 'The tub lid does not seal tightly and some powder spilled during shipping.', '2026-03-03', 2, @empty_embedding),
(8, 'Decent for the price', 'Not the best creatine I have used but reasonably priced for a basic monohydrate supplement.', '2026-03-11', 3, @empty_embedding),
(8, 'Some bloating during loading phase', 'The recommended loading dose gave me noticeable bloating for the first several days.', '2026-03-19', 2, @empty_embedding),
(8, 'Works fine mixed into protein shake', 'I just toss a scoop into my protein shake and have not had any issues with taste or texture.', '2026-03-27', 4, @empty_embedding),
(8, 'No noticeable difference', 'Used a full tub over two months and honestly could not tell it was doing much for my performance.', '2026-04-04', 2, @empty_embedding),
(8, 'Scoop size is inconsistent', 'The included scoop does not always give a consistent measurement between servings.', '2026-04-12', 3, @empty_embedding),
(8, 'Fine as a basic supplement', 'Does the job as a no-frills creatine, would not go out of my way to repurchase over other brands though.', '2026-04-20', 3, @empty_embedding),
(8, 'Mild headaches when I started', 'Had some headaches the first few days which went away once I increased my water intake.', '2026-04-28', 2, @empty_embedding),

-- Product 9: DemoHealth Zinc + Vitamin C (DemoHealth) - mostly negative
(9, 'Upset my stomach every time', 'No matter when I take it, whether with food or not, I get stomach cramps within the hour.', '2026-01-05', 1, @empty_embedding),
(9, 'Tablets are oddly large', 'Struggle to swallow these every single time, they are much bigger than other zinc supplements I have tried.', '2026-01-13', 2, @empty_embedding),
(9, 'Metallic aftertaste', 'Leaves an unpleasant metallic taste in my mouth for a while after taking it.', '2026-01-21', 2, @empty_embedding),
(9, 'Caused nausea', 'Felt nauseous almost every morning after taking this on an empty stomach.', '2026-01-29', 1, @empty_embedding),
(9, 'No noticeable immune benefit', 'Took this through an entire cold and flu season and still got sick twice.', '2026-02-06', 2, @empty_embedding),
(9, 'Bottle arrived damaged', 'Cap was cracked and several tablets had crumbled to powder inside the bottle.', '2026-02-14', 1, @empty_embedding),
(9, 'Gave me heartburn', 'Consistently causes a burning sensation in my chest, even when taken with a full meal.', '2026-02-22', 2, @empty_embedding),
(9, 'Way too high a dose', 'Dosage feels excessive compared to the recommended daily zinc intake and made me feel jittery.', '2026-03-02', 2, @empty_embedding),
(9, 'Smell is off-putting', 'Tablets have a strong chemical smell when you open the bottle which is a bit concerning.', '2026-03-10', 1, @empty_embedding),
(9, 'Did not help at all', 'Bought this hoping to boost my immune system before a trip and still ended up sick.', '2026-03-18', 2, @empty_embedding),
(9, 'Caused a rash', 'Developed itchy red patches on my arms a few days after starting this supplement.', '2026-03-26', 1, @empty_embedding),
(9, 'Overpriced for what it is', 'Way more expensive than similar zinc and vitamin C combos with no added benefit that I could tell.', '2026-04-03', 2, @empty_embedding),
(9, 'Actually helped my energy', 'One of the few things that gave me a small energy boost, though the stomach upset was annoying.', '2026-04-11', 3, @empty_embedding),
(9, 'Hard to swallow and no benefit', 'Combination of a large pill size and no noticeable effect makes this a pass for me.', '2026-04-19', 1, @empty_embedding),
(9, 'Customer service ignored my complaint', 'Reached out about a defective batch and never got a response back.', '2026-04-27', 1, @empty_embedding);
