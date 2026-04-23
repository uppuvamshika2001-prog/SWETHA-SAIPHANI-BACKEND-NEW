SELECT m.name, m.price_per_unit, m.pack_quantity, m.stock_quantity,
       mb.batch_number, mb.selling_price as batch_selling_price, mb.pack_quantity as batch_pack_quantity
FROM medicines m
LEFT JOIN medicine_batches mb ON mb.medicine_id::text = m.id::text
WHERE m.name ILIKE '%dolo%';
