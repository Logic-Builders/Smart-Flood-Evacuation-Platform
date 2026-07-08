-- Redo road_nodes with UUID node_id to match road_segments schema.
-- Run this AFTER import_roads.py (which deletes/reinserts road_segments) and AFTER
-- 001_add_node_id_columns.sql (which adds the start_node_id/end_node_id columns).
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
-- GIST index for nearest-node KNN lookups (ORDER BY geom <-> point), used by
-- PostgresRoadRepository.NearestNodeID in road_repository.go.
CREATE INDEX idx_road_nodes_geom ON flood_system.road_nodes USING GIST (geom);

UPDATE flood_system.road_segments rs
SET start_node_id = rn.node_id
FROM flood_system.road_nodes rn
WHERE ST_AsText(rs.start_point) = ST_AsText(rn.geom);

UPDATE flood_system.road_segments rs
SET end_node_id = rn.node_id
FROM flood_system.road_nodes rn
WHERE ST_AsText(rs.end_point) = ST_AsText(rn.geom);

ALTER TABLE flood_system.road_segments
    DROP CONSTRAINT IF EXISTS fk_start_node,
    DROP CONSTRAINT IF EXISTS fk_end_node,
    ADD CONSTRAINT fk_start_node FOREIGN KEY (start_node_id) REFERENCES flood_system.road_nodes(node_id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_end_node   FOREIGN KEY (end_node_id)   REFERENCES flood_system.road_nodes(node_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roads_start_node ON flood_system.road_segments(start_node_id);
CREATE INDEX IF NOT EXISTS idx_roads_end_node   ON flood_system.road_segments(end_node_id);

SELECT COUNT(*) AS still_null
FROM flood_system.road_segments
WHERE start_node_id IS NULL OR end_node_id IS NULL;