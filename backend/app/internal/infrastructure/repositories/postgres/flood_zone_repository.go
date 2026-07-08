package postgres

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

// PostgresFloodZoneRepository implements repositories.FloodDataSource using the
// flood_risk_zones table (PostGIS polygons) instead of a mock/external API.
type PostgresFloodZoneRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresFloodZoneRepository(pool *pgxpool.Pool) *PostgresFloodZoneRepository {
	return &PostgresFloodZoneRepository{pool: pool}
}

// geoJSONPolygon models the subset of GeoJSON ST_AsGeoJSON(geometry) produces for
// a PostGIS Polygon column: {"type":"Polygon","coordinates":[[[lng,lat],...]]}.
type geoJSONPolygon struct {
	Coordinates [][][2]float64 `json:"coordinates"`
}

// GetFloodZones returns all currently active flood risk zones. The region filter
// is not yet applied (MVP: the mobile app fetches all active zones for its area).
func (r *PostgresFloodZoneRepository) GetFloodZones(region domain.GeoPolygon) ([]*domain.FloodZone, error) {
	query := `
		SELECT zone_id, gauge_id, severity, ST_AsGeoJSON(geometry)
		FROM flood_system.active_flood_zones
	`
	rows, err := r.pool.Query(context.Background(), query)
	if err != nil {
		return nil, fmt.Errorf("failed to query flood zones: %w", err)
	}
	defer rows.Close()

	var zones []*domain.FloodZone
	for rows.Next() {
		var zone domain.FloodZone
		var gaugeID *string
		var severity string
		var geoJSON string

		if err := rows.Scan(&zone.ID, &gaugeID, &severity, &geoJSON); err != nil {
			return nil, fmt.Errorf("failed to scan flood zone: %w", err)
		}
		if gaugeID != nil {
			zone.GaugeID = *gaugeID
		}
		zone.Severity = domain.FloodSeverity(severity)

		boundary, err := parseGeoJSONPolygon(geoJSON)
		if err != nil {
			return nil, fmt.Errorf("failed to parse zone %s boundary: %w", zone.ID, err)
		}
		zone.Boundary = boundary

		zones = append(zones, &zone)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return zones, nil
}

// GetFloodStatus returns the current severity/location for a specific gauge.
func (r *PostgresFloodZoneRepository) GetFloodStatus(gaugeID string) (*domain.FloodStatus, error) {
	query := `
		SELECT severity, ST_Y(ST_Centroid(geometry)), ST_X(ST_Centroid(geometry))
		FROM flood_system.flood_risk_zones
		WHERE gauge_id = $1 AND is_active = TRUE
		ORDER BY updated_at DESC
		LIMIT 1
	`
	var severity string
	var lat, lng float64
	err := r.pool.QueryRow(context.Background(), query, gaugeID).Scan(&severity, &lat, &lng)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("no active flood status for gauge: %s", gaugeID)
		}
		return nil, fmt.Errorf("failed to fetch flood status: %w", err)
	}

	return &domain.FloodStatus{
		GaugeID:  gaugeID,
		Level:    domain.FloodSeverity(severity),
		Location: domain.GeoPoint{Lat: lat, Lng: lng},
	}, nil
}

func parseGeoJSONPolygon(geoJSON string) (domain.GeoPolygon, error) {
	var parsed geoJSONPolygon
	if err := json.Unmarshal([]byte(geoJSON), &parsed); err != nil {
		return domain.GeoPolygon{}, err
	}
	if len(parsed.Coordinates) == 0 {
		return domain.GeoPolygon{}, fmt.Errorf("polygon has no rings")
	}

	ring := parsed.Coordinates[0] // outer ring; holes (if any) are ignored
	points := make([]domain.GeoPoint, 0, len(ring))
	for _, coord := range ring {
		points = append(points, domain.GeoPoint{Lng: coord[0], Lat: coord[1]})
	}

	return domain.GeoPolygon{Coordinates: points}, nil
}
