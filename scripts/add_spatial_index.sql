CREATE INDEX IF NOT EXISTS idx_road_nodes_geom ON flood_system.road_nodes USING GIST (geom);
