-- road_segments has no start_node_id/end_node_id columns in the base schema (database.sql).
-- fix_node_ids_v2.sql backfills these but assumes the columns already exist — add them first.
ALTER TABLE flood_system.road_segments
    ADD COLUMN IF NOT EXISTS start_node_id UUID,
    ADD COLUMN IF NOT EXISTS end_node_id   UUID;
