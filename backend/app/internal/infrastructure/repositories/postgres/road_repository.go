package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

// PostgresRoadRepository implements repositories.RoadRepository using the
// PostGIS-backed road_segments/road_nodes tables (real Ampara District OSM data,
// imported via scripts/import_roads.py + scripts/fix_node_ids_v2.sql).
type PostgresRoadRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRoadRepository(pool *pgxpool.Pool) *PostgresRoadRepository {
	return &PostgresRoadRepository{pool: pool}
}

// GetAllSegments loads the full routable graph. Segments missing a node backfill
// (start_node_id/end_node_id) or point geometry are skipped — they can't be placed
// in the graph.
func (r *PostgresRoadRepository) GetAllSegments() ([]*domain.RoadSegment, error) {
	query := `
		SELECT segment_id, start_node_id, end_node_id,
		       COALESCE(length_meters, 0), condition, flood_risk, hazard_score, is_one_way,
		       ST_Y(start_point), ST_X(start_point), ST_Y(end_point), ST_X(end_point)
		FROM flood_system.road_segments
		WHERE start_node_id IS NOT NULL AND end_node_id IS NOT NULL
		  AND start_point IS NOT NULL AND end_point IS NOT NULL
	`
	rows, err := r.pool.Query(context.Background(), query)
	if err != nil {
		return nil, fmt.Errorf("failed to query road segments: %w", err)
	}
	defer rows.Close()

	var segments []*domain.RoadSegment
	for rows.Next() {
		var seg domain.RoadSegment
		var lengthMeters float64
		var startLat, startLng, endLat, endLng float64

		if err := rows.Scan(
			&seg.ID, &seg.StartNodeID, &seg.EndNodeID,
			&lengthMeters, &seg.Condition, &seg.FloodRisk, &seg.HazardScore, &seg.IsOneWay,
			&startLat, &startLng, &endLat, &endLng,
		); err != nil {
			return nil, fmt.Errorf("failed to scan road segment: %w", err)
		}

		seg.Distance = lengthMeters / 1000.0 // km, consistent with geo.Haversine's unit
		seg.StartPoint = domain.GeoPoint{Lat: startLat, Lng: startLng}
		seg.EndPoint = domain.GeoPoint{Lat: endLat, Lng: endLng}
		segments = append(segments, &seg)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return segments, nil
}

// GetRoadsByArea returns segments whose geometry intersects the given polygon.
func (r *PostgresRoadRepository) GetRoadsByArea(polygon domain.GeoPolygon) ([]*domain.RoadSegment, error) {
	wkt, err := polygonToWKT(polygon)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT segment_id, start_node_id, end_node_id,
		       COALESCE(length_meters, 0), condition, flood_risk, hazard_score, is_one_way,
		       ST_Y(start_point), ST_X(start_point), ST_Y(end_point), ST_X(end_point)
		FROM flood_system.road_segments
		WHERE start_point IS NOT NULL AND end_point IS NOT NULL
		  AND ST_Intersects(geometry, ST_SetSRID(ST_GeomFromText($1), 4326))
	`
	rows, err := r.pool.Query(context.Background(), query, wkt)
	if err != nil {
		return nil, fmt.Errorf("failed to query roads by area: %w", err)
	}
	defer rows.Close()

	var segments []*domain.RoadSegment
	for rows.Next() {
		var seg domain.RoadSegment
		var lengthMeters float64
		var startLat, startLng, endLat, endLng float64

		if err := rows.Scan(
			&seg.ID, &seg.StartNodeID, &seg.EndNodeID,
			&lengthMeters, &seg.Condition, &seg.FloodRisk, &seg.HazardScore, &seg.IsOneWay,
			&startLat, &startLng, &endLat, &endLng,
		); err != nil {
			return nil, fmt.Errorf("failed to scan road segment: %w", err)
		}

		seg.Distance = lengthMeters / 1000.0
		seg.StartPoint = domain.GeoPoint{Lat: startLat, Lng: startLng}
		seg.EndPoint = domain.GeoPoint{Lat: endLat, Lng: endLng}
		segments = append(segments, &seg)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return segments, nil
}

// GetRoadByID fetches a single road segment.
func (r *PostgresRoadRepository) GetRoadByID(id uuid.UUID) (*domain.RoadSegment, error) {
	query := `
		SELECT segment_id, start_node_id, end_node_id,
		       COALESCE(length_meters, 0), condition, flood_risk, hazard_score, is_one_way,
		       ST_Y(start_point), ST_X(start_point), ST_Y(end_point), ST_X(end_point)
		FROM flood_system.road_segments
		WHERE segment_id = $1
	`
	var seg domain.RoadSegment
	var lengthMeters float64
	var startLat, startLng, endLat, endLng float64

	err := r.pool.QueryRow(context.Background(), query, id).Scan(
		&seg.ID, &seg.StartNodeID, &seg.EndNodeID,
		&lengthMeters, &seg.Condition, &seg.FloodRisk, &seg.HazardScore, &seg.IsOneWay,
		&startLat, &startLng, &endLat, &endLng,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("road segment not found: %s", id)
		}
		return nil, fmt.Errorf("failed to scan road segment: %w", err)
	}

	seg.Distance = lengthMeters / 1000.0
	seg.StartPoint = domain.GeoPoint{Lat: startLat, Lng: startLng}
	seg.EndPoint = domain.GeoPoint{Lat: endLat, Lng: endLng}
	return &seg, nil
}

// UpdateRoadWeight updates a segment's flood risk / hazard score (e.g. after a
// report is approved nearby).
func (r *PostgresRoadRepository) UpdateRoadWeight(id uuid.UUID, floodRisk, hazardScore float64) error {
	query := `
		UPDATE flood_system.road_segments
		SET flood_risk = $1, hazard_score = $2, last_updated = NOW()
		WHERE segment_id = $3
	`
	_, err := r.pool.Exec(context.Background(), query, floodRisk, hazardScore, id)
	if err != nil {
		return fmt.Errorf("failed to update road weight: %w", err)
	}
	return nil
}

// NearestNodeID finds the closest road_nodes row to (lat, lng) using the GIST index
// on geom for a fast KNN lookup (see scripts/fix_node_ids_v2.sql).
func (r *PostgresRoadRepository) NearestNodeID(lat, lng float64) (uuid.UUID, error) {
	query := `
		SELECT node_id
		FROM flood_system.road_nodes
		ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
		LIMIT 1
	`
	var id uuid.UUID
	err := r.pool.QueryRow(context.Background(), query, lng, lat).Scan(&id)
	if err != nil {
		if err == pgx.ErrNoRows {
			return uuid.Nil, fmt.Errorf("no road nodes found near (%f, %f)", lat, lng)
		}
		return uuid.Nil, fmt.Errorf("failed to find nearest node: %w", err)
	}
	return id, nil
}

// NodeCoords returns the lat/lng for a given road_nodes row.
func (r *PostgresRoadRepository) NodeCoords(nodeID uuid.UUID) (lat, lng float64, err error) {
	query := `SELECT ST_Y(geom), ST_X(geom) FROM flood_system.road_nodes WHERE node_id = $1`
	err = r.pool.QueryRow(context.Background(), query, nodeID).Scan(&lat, &lng)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, 0, fmt.Errorf("node not found: %s", nodeID)
		}
		return 0, 0, fmt.Errorf("failed to fetch node coords: %w", err)
	}
	return lat, lng, nil
}

// GetNetworkForMap returns the road network in the same shape as the old
// data.GetDemoNodes()/data.SegmentsForMap() so GetNetwork's JSON contract is
// unchanged for existing consumers (dashboard Map.jsx).
func (r *PostgresRoadRepository) GetNetworkForMap() (nodes, segments []map[string]interface{}, err error) {
	nodeRows, err := r.pool.Query(context.Background(), `
		SELECT node_id, ST_Y(geom), ST_X(geom) FROM flood_system.road_nodes
	`)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to query road nodes: %w", err)
	}
	defer nodeRows.Close()

	for nodeRows.Next() {
		var id uuid.UUID
		var lat, lng float64
		if err := nodeRows.Scan(&id, &lat, &lng); err != nil {
			return nil, nil, fmt.Errorf("failed to scan road node: %w", err)
		}
		nodes = append(nodes, map[string]interface{}{
			"id":  id.String(),
			"lat": lat,
			"lng": lng,
		})
	}
	if err := nodeRows.Err(); err != nil {
		return nil, nil, err
	}

	segRows, err := r.pool.Query(context.Background(), `
		SELECT ST_Y(start_point), ST_X(start_point), ST_Y(end_point), ST_X(end_point)
		FROM flood_system.road_segments
		WHERE start_point IS NOT NULL AND end_point IS NOT NULL
	`)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to query road segments: %w", err)
	}
	defer segRows.Close()

	for segRows.Next() {
		var startLat, startLng, endLat, endLng float64
		if err := segRows.Scan(&startLat, &startLng, &endLat, &endLng); err != nil {
			return nil, nil, fmt.Errorf("failed to scan road segment: %w", err)
		}
		segments = append(segments, map[string]interface{}{
			"start": []float64{startLat, startLng},
			"end":   []float64{endLat, endLng},
		})
	}
	if err := segRows.Err(); err != nil {
		return nil, nil, err
	}

	return nodes, segments, nil
}

// SetConditionInArea bulk-updates every road segment whose geometry falls
// within radiusKM of center (e.g. a dam's downstream alert radius, or a
// newly-created flood zone) to the given condition. Returns rows affected.
func (r *PostgresRoadRepository) SetConditionInArea(center domain.GeoPoint, radiusKM float64, condition domain.RoadCondition) (int, error) {
	query := `
		UPDATE flood_system.road_segments
		SET condition = $1, last_updated = NOW()
		WHERE ST_DWithin(
			geometry::geography,
			ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
			$4
		)
	`
	tag, err := r.pool.Exec(context.Background(), query, string(condition), center.Lng, center.Lat, radiusKM*1000)
	if err != nil {
		return 0, fmt.Errorf("failed to update road conditions in area: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

// SetConditionInPolygon bulk-updates every road segment intersecting the
// given polygon to the given condition. Returns rows affected.
func (r *PostgresRoadRepository) SetConditionInPolygon(polygon domain.GeoPolygon, condition domain.RoadCondition) (int, error) {
	wkt, err := polygonToWKT(polygon)
	if err != nil {
		return 0, err
	}
	query := `
		UPDATE flood_system.road_segments
		SET condition = $1, last_updated = NOW()
		WHERE ST_Intersects(geometry, ST_SetSRID(ST_GeomFromText($2), 4326))
	`
	tag, err := r.pool.Exec(context.Background(), query, string(condition), wkt)
	if err != nil {
		return 0, fmt.Errorf("failed to update road conditions in polygon: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

// polygonToWKT renders a domain.GeoPolygon as a WKT POLYGON string, closing the
// ring if the caller didn't repeat the first point as the last.
func polygonToWKT(polygon domain.GeoPolygon) (string, error) {
	if len(polygon.Coordinates) < 3 {
		return "", fmt.Errorf("polygon must have at least 3 points, got %d", len(polygon.Coordinates))
	}

	points := polygon.Coordinates
	first, last := points[0], points[len(points)-1]
	closed := first.Lat == last.Lat && first.Lng == last.Lng

	var b strings.Builder
	b.WriteString("POLYGON((")
	for i, p := range points {
		if i > 0 {
			b.WriteString(", ")
		}
		fmt.Fprintf(&b, "%f %f", p.Lng, p.Lat)
	}
	if !closed {
		fmt.Fprintf(&b, ", %f %f", first.Lng, first.Lat)
	}
	b.WriteString("))")
	return b.String(), nil
}
