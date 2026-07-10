package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
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

// DeactivateZone marks a flood zone inactive (soft delete) so it stops
// appearing in GetFloodZones/the active_flood_zones view, returning its
// boundary so callers can revert any roads auto-blocked because of it.
func (r *PostgresFloodZoneRepository) DeactivateZone(id uuid.UUID) (domain.GeoPolygon, error) {
	query := `
		UPDATE flood_system.flood_risk_zones SET is_active = FALSE
		WHERE zone_id = $1
		RETURNING ST_AsGeoJSON(geometry)
	`
	var geoJSON string
	err := r.pool.QueryRow(context.Background(), query, id).Scan(&geoJSON)
	if err != nil {
		if err == pgx.ErrNoRows {
			return domain.GeoPolygon{}, errors.New("flood zone not found")
		}
		return domain.GeoPolygon{}, fmt.Errorf("failed to deactivate flood zone: %w", err)
	}
	return parseGeoJSONPolygon(geoJSON)
}

// CreateZone inserts a flood warning as a circular zone (ST_Buffer on
// geography gives an accurate geodesic circle in meters, then cast back to
// geometry so it matches the column type / SRID 4326). gaugeID/dataSource are
// empty/"Manual Entry" for dashboard-created zones, or set by the Flood Hub
// poller so it can find-and-update its own zones on later polls without
// creating duplicates (see floodhub.Poller).
func (r *PostgresFloodZoneRepository) CreateZone(zoneName string, severity domain.FloodSeverity, center domain.GeoPoint, radiusKM float64, gaugeID, dataSource string) (*domain.FloodZone, error) {
	if dataSource == "" {
		dataSource = "Manual Entry"
	}
	query := `
		INSERT INTO flood_system.flood_risk_zones
			(gauge_id, zone_name, severity, confidence_score, geometry, data_source, is_active)
		VALUES (
			NULLIF($1, ''), $2, $3, 0.9,
			ST_Buffer(ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6)::geometry,
			$7, TRUE
		)
		RETURNING zone_id, ST_AsGeoJSON(geometry)
	`
	var id uuid.UUID
	var geoJSON string
	err := r.pool.QueryRow(context.Background(), query,
		gaugeID, zoneName, string(severity), center.Lng, center.Lat, radiusKM*1000, dataSource,
	).Scan(&id, &geoJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to create flood zone: %w", err)
	}

	boundary, err := parseGeoJSONPolygon(geoJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to parse created zone boundary: %w", err)
	}

	return &domain.FloodZone{ID: id, GaugeID: gaugeID, Severity: severity, Boundary: boundary}, nil
}

// FindActiveZoneByGauge returns the ID of the current active zone for a
// gauge, if any.
func (r *PostgresFloodZoneRepository) FindActiveZoneByGauge(gaugeID string) (uuid.UUID, error) {
	query := `
		SELECT zone_id FROM flood_system.flood_risk_zones
		WHERE gauge_id = $1 AND is_active = TRUE
		ORDER BY updated_at DESC
		LIMIT 1
	`
	var id uuid.UUID
	err := r.pool.QueryRow(context.Background(), query, gaugeID).Scan(&id)
	if err != nil {
		if err == pgx.ErrNoRows {
			return uuid.Nil, fmt.Errorf("no active zone for gauge: %s", gaugeID)
		}
		return uuid.Nil, fmt.Errorf("failed to find zone for gauge: %w", err)
	}
	return id, nil
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
