-- Query to verify TAQA seeding off-by-one error
-- Jan 12, 2026: 
-- Excel Row 55 (Declared Capacity) = 6000
-- Excel Row 56 (Deemed Gen) = 2394.9
-- If bug exists, declared_capacity_mwhr will be 2394.9 instead of 6000.

SELECT 
    entry_date, 
    declared_capacity_mwhr, 
    deemed_gen_mwhr, 
    dispatch_demand_mwhr
FROM taqa_daily_input
WHERE entry_date = '2026-01-12' 
  AND plant_id = (SELECT id FROM plants WHERE short_name = 'TAQA');

-- Another check for Jan 2:
-- Excel Row 55 (DC) = 6000
-- Excel Row 56 (Deemed Gen) = 515
SELECT 
    entry_date, 
    declared_capacity_mwhr, 
    deemed_gen_mwhr 
FROM taqa_daily_input
WHERE entry_date = '2026-01-02' 
  AND plant_id = (SELECT id FROM plants WHERE short_name = 'TAQA');
