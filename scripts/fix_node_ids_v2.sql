-- Redo road_nodes with UUID node_id to match road_segments schema
DROP TABLE IF EXISTS flood_system.road_nodes;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE flood_system.road_nodes (
    node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geom GEOMETRY(Point, 4326)
);

INSERT INTO flood_system.road_nodes (geom)
SELECT (array_agg(pt))[1]
FROM (
    SELECT start_point AS pt FROM flood_system.road_segments WHERE start_point IS NOT NULL
    UNION ALL
    SELECT end_point AS pt FROM flood_system.road_segments WHERE end_point IS NOT NULL
) all_points
GROUP BY ST_AsText(pt);

CREATE INDEX idx_road_nodes_geom_text ON flood_system.road_nodes (ST_AsText(geom));

UPDATE flood_system.road_segments rs
SET start_node_id = rn.node_id
FROM flood_system.road_nodes rn
WHERE ST_AsText(rs.start_point) = ST_AsText(rn.geom);

UPDATE flood_system.road_segments rs
SET end_node_id = rn.node_id
FROM flood_system.road_nodes rn
WHERE ST_AsText(rs.end_point) = ST_AsText(rn.geom);

SELECT COUNT(*) AS still_null
FROM flood_system.road_segments
WHERE start_node_id IS NULL OR end_node_id IS NULL;