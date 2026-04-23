-- 1. Update master pack_quantity from batches if it's currently 0 or 1
UPDATE medicines m
SET pack_quantity = (
  SELECT mb.pack_quantity 
  FROM medicine_batches mb 
  WHERE mb.medicine_id::text = m.id::text 
    AND mb.pack_quantity > 1 
  LIMIT 1
)
WHERE (m.pack_quantity = 0 OR m.pack_quantity = 1)
  AND EXISTS (SELECT 1 FROM medicine_batches mb WHERE mb.medicine_id::text = m.id::text AND mb.pack_quantity > 1);

-- 2. Normalize price_per_unit in master table
UPDATE medicines
SET price_per_unit = price_per_unit / COALESCE(NULLIF(pack_quantity, 0), 1)
WHERE pack_quantity > 1 
  AND price_per_unit > 5; -- Heuristic to avoid accidental double-division if already small

-- 3. Just to be safe, if price_per_unit is exactly same as batch selling_price, divide it
UPDATE medicines m
SET price_per_unit = m.price_per_unit / COALESCE(NULLIF(m.pack_quantity, 0), 1)
FROM medicine_batches mb
WHERE mb.medicine_id::text = m.id::text 
  AND mb.pack_quantity > 1
  AND m.price_per_unit = mb.selling_price;
