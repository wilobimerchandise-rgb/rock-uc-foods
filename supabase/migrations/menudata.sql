-- 1. Insert Categories (Using 'status' to match the actual repo schema)
WITH new_cats AS (
  INSERT INTO menu_categories (name, sort_order, status)
  VALUES
    ('Soups & Swallow', 10, 'published'),
    ('Rice Meals', 20, 'published'),
    ('Sides / Proteins', 30, 'published')
  RETURNING id, name
)
-- 2. Insert Menu Items (Matching the EXACT current repo columns)
INSERT INTO menu_items (category_id, name, portion, price_kobo, status, sold_out_today)
SELECT
  cat.id,
  item.name,
  item.portion,
  item.price_kobo,
  item.status,
  false -- sold_out_today
FROM new_cats cat
JOIN (
  VALUES
    ('Soups & Swallow', 'Semo & Egusi', 'Serves 1', 350000, 'draft'),
    ('Rice Meals', 'Party Jollof Rice & Grilled Chicken', 'Serves 1', 450000, 'draft'),
    ('Sides / Proteins', 'Peppered Meat', 'Serves 1', 250000, 'draft')
) AS item(cat_name, name, portion, price_kobo, status)
ON cat.name = item.cat_name;
