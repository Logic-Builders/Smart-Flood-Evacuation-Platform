package repositories

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

type PostgresFloodZoneRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresFloodZoneRepository(pool *pgxpool.Pool) *PostgresFloodZoneRepository {
	return &PostgresFloodZoneRepository{pool: pool}
}

type geoJSONPolygon struct {
	Coordinates [][][]float64 `json: "coordinates"`
}

func (r *PostgresFloodZoneRepository) FindAllActive() ([]*domain.FloodZone, error) {
	query := `
		SELECT zone_id, gauge_id, severity, ST_AsGeoJSON(geometry) as boundary_geojson
		FROM flood_system.flood_risk_zones
		WHERE is_active = TRUE
	`

	rows, err := r.pool.Query(context.Background(), query)
	if err != nil {
		return nil, fmt.Errorf("flood zone query failed: %w", err)
	}
	defer rows.Close()

	var zones []*domain.FloodZone
	for rows.Next() {
		z := &domain.FloodZone{}
		var boundaryJSON string
		var severity string

		err := rows.Scan(&z.ID, &z.GaugeID, &severity, &boundaryJSON)
		if err != nil {
			return nil, err
		}

		z.Severity = domain.FloodSeverity(severity)

		var geojson geoJSONPolygon
		if err := json.Unmarshal([]byte(boundaryJSON), &geojson); err != nil {
			return nil, err
		}

		if len(geojson.Coordinates) > 0 {
			for _, coord := range geojson.Coordinates[0] {
				z.Boundary.Coordinates = append(z.Boundary.Coordinates, domain.GeoPoint{
					Lng: coord[0],
					Lat: coord[1],
				})
			}
		}

		zones = append(zones, z)
	}
	return zones, rows.Err()
}
