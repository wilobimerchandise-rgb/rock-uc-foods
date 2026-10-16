-- 1. Insert Categories
WITH new_cats AS (
  INSERT INTO menu_categories (name, sort_order, status, is_visible)
  VALUES
    ('Soups & Swallow', 10, 'published', true),
    ('Rice Meals', 20, 'published', true),
    ('Sides / Proteins', 30, 'published', true)
  RETURNING id, name
)
-- 2. Insert Menu Items (Prices in bigint kobo)
INSERT INTO menu_items (sku, category_id, name, description, price_kobo, portion_label, allergens, status, is_available, is_featured, sort_order)
SELECT
  item.sku,
  cat.id,
  item.name,
  item.description,
  item.price_kobo,
  item.portion_label,
  item.allergens,
  item.status,
  item.is_available,
  item.is_featured,
  item.sort_order
FROM new_cats cat
JOIN (
  VALUES
    ('SEM-001', 'Soups & Swallow', 'Semo & Egusi', NULL, 350000, 'Serves 1', '{}'::text[], 'draft', true, false, 10),
    ('JOL-001', 'Rice Meals', 'Party Jollof Rice & Grilled Chicken', NULL, 450000, 'Serves 1', '{}'::text[], 'draft', true, false, 20),
    ('PEP-001', 'Sides / Proteins', 'Peppered Meat', NULL, 250000, 'Serves 1', '{}'::text[], 'draft', true, false, 30)
) AS item(sku, cat_name, name, description, price_kobo, portion_label, allergens, status, is_available, is_featured, sort_order)
ON cat.name = item.cat_name;
