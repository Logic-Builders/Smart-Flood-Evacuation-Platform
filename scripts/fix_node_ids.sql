-- Step 1: Table to hold unique intersection points (nodes)
CREATE TABLE IF NOT EXISTS flood_system.road_nodes (
    node_id SERIAL PRIMARY KEY,
    geom GEOMETRY(Point, 4326)
);

-- Step 2: Populate it with every distinct start/end point across all segments
-- (GROUP BY on the text form avoids PostGIS's fuzzy geometry equality issues)
INSERT INTO flood_system.road_nodes (geom)
SELECT (array_agg(pt))[1]
FROM (
    SELECT start_point AS pt FROM flood_system.road_segments WHERE start_point IS NOT NULL
    UNION ALL
    SELECT end_point AS pt FROM flood_system.road_segments WHERE end_point IS NOT NULL
) all_points
GROUP BY ST_AsText(pt);

-- Step 3: Index for fast matching (speeds up the updates below a lot on 44k rows)
CREATE INDEX IF NOT EXISTS idx_road_nodes_geom_text ON flood_system.road_nodes (ST_AsText(geom));

-- Step 4: Back-fill start_node_id
UPDATE flood_system.road_segments rs
SET start_node_id = rn.node_id
FROM flood_system.road_nodes rn
WHERE ST_AsText(rs.start_point) = ST_AsText(rn.geom);

-- Step 5: Back-fill end_node_id
UPDATE flood_system.road_segments rs
SET end_node_id = rn.node_id
FROM flood_system.road_nodes rn
WHERE ST_AsText(rs.end_point) = ST_AsText(rn.geom);

-- Step 6: Sanity check — should return 0 rows
SELECT COUNT(*) AS still_null
FROM flood_system.road_segments
WHERE start_node_id IS NULL OR end_node_id IS NULL;