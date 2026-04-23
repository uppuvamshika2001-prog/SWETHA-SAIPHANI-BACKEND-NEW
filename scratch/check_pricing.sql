SELECT m.name, m.price_per_unit, b.selling_price, b.pack_quantity 
FROM medicines m 
JOIN medicine_batches b ON m.id = b.medicine_id::text 
WHERE b.is_active = true
LIMIT 10;
