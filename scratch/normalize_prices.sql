-- Logic: For medicines with pack size > 1, if unit_price is high (strip price), divide it.
-- We'll assume any unit_price > 0 for a medicine with pack_quantity > 1 presently holds the strip price.

-- Update Medicine Master
UPDATE medicines 
SET price_per_unit = price_per_unit / pack_quantity
WHERE pack_quantity > 1 AND price_per_unit > 0;

-- Update Medicine Batches (actually we don't have price_per_unit column in schema, but we should fix it in formatted responses)
-- Wait! My backend code now uses sellingPrice / packQuantity in formatMedicine.
-- So I only need to fix Medicine.price_per_unit for the master table.
