package repositories

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

type PostgresRoadRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRoadRepository(pool *pgxpool.Pool) *PostgresRoadRepository {
	return &PostgresRoadRepository{pool: pool}
}

// GetSegmentsInBoundingBox pulls only the segments near the requested trip,
// instead of loading all ~44k rows on every request.
func (r *PostgresRoadRepository) GetSegmentsInBoundingBox(minLat, minLng, maxLat, maxLng float64) ([]*domain.RoadSegment, error) {
	rows, err := r.pool.Query(context.Background(), `
		SELECT id, start_node_id, end_node_id, distance, condition,
		       flood_risk, hazard_score,
		       ST_Y(start_point), ST_X(start_point),
		       ST_Y(end_point), ST_X(end_point)
		FROM flood_system.road_segments
		WHERE start_point && ST_MakeEnvelope($1, $2, $3, $4, 4326)
		   OR end_point && ST_MakeEnvelope($1, $2, $3, $4, 4326)
	`, minLng, minLat, maxLng, maxLat)
	if err != nil {
		return nil, fmt.Errorf("query segments: %w", err)
	}
	defer rows.Close()

	var segments []*domain.RoadSegment
	for rows.Next() {
		var s domain.RoadSegment
		var startLat, startLng, endLat, endLng float64
		if err := rows.Scan(&s.ID, &s.StartNodeID, &s.EndNodeID, &s.Distance, &s.Condition,
			&s.FloodRisk, &s.HazardScore, &startLat, &startLng, &endLat, &endLng); err != nil {
			return nil, fmt.Errorf("scan segment: %w", err)
		}
		s.StartPoint = domain.GeoPoint{Lat: startLat, Lng: startLng}
		s.EndPoint = domain.GeoPoint{Lat: endLat, Lng: endLng}
		segments = append(segments, &s)
	}
	return segments, rows.Err()
}

func (r *PostgresRoadRepository) GetRoadsByArea(polygon domain.GeoPolygon) ([]*domain.RoadSegment, error) {
	// Not needed yet for point-to-point routing; implement later if you add
	// "show all roads in this flood zone" type features.
	return nil, fmt.Errorf("not implemented")
}

func (r *PostgresRoadRepository) GetRoadByID(id uuid.UUID) (*domain.RoadSegment, error) {
	var s domain.RoadSegment
	var startLat, startLng, endLat, endLng float64
	err := r.pool.QueryRow(context.Background(), `
		SELECT id, start_node_id, end_node_id, distance, condition,
		       flood_risk, hazard_score,
		       ST_Y(start_point), ST_X(start_point),
		       ST_Y(end_point), ST_X(end_point)
		FROM flood_system.road_segments WHERE id = $1
	`, id).Scan(&s.ID, &s.StartNodeID, &s.EndNodeID, &s.Distance, &s.Condition,
		&s.FloodRisk, &s.HazardScore, &startLat, &startLng, &endLat, &endLng)
	if err != nil {
		return nil, fmt.Errorf("get road by id: %w", err)
	}
	s.StartPoint = domain.GeoPoint{Lat: startLat, Lng: startLng}
	s.EndPoint = domain.GeoPoint{Lat: endLat, Lng: endLng}
	return &s, nil
}

func (r *PostgresRoadRepository) UpdateRoadWeight(id uuid.UUID, floodRisk, hazardScore float64) error {
	_, err := r.pool.Exec(context.Background(), `
		UPDATE flood_system.road_segments
		SET flood_risk = $2, hazard_score = $3
		WHERE id = $1
	`, id, floodRisk, hazardScore)
	return err
}

func (r *PostgresRoadRepository) NearestNode(lat, lng float64) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.pool.QueryRow(context.Background(), `
		SELECT node_id FROM flood_system.road_nodes
		ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
		LIMIT 1
	`, lng, lat).Scan(&id)
	if err != nil {
		return uuid.Nil, fmt.Errorf("nearest node: %w", err)
	}
	return id, nil
}

func (r *PostgresRoadRepository) NodeCoords(id uuid.UUID) (float64, float64, error) {
	var lat, lng float64
	err := r.pool.QueryRow(context.Background(), `
		SELECT ST_Y(geom), ST_X(geom) FROM flood_system.road_nodes WHERE node_id = $1
	`, id).Scan(&lat, &lng)
	if err != nil {
		return 0, 0, fmt.Errorf("node coords: %w", err)
	}
	return lat, lng, nil
}
