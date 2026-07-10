package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

// PostgresDamRepository implements repositories.DamRepository using the
// dam_stations table.
type PostgresDamRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresDamRepository(pool *pgxpool.Pool) *PostgresDamRepository {
	return &PostgresDamRepository{pool: pool}
}

const damSelectColumns = `
	station_id, station_name, COALESCE(river_name, ''), ST_Y(location), ST_X(location),
	COALESCE(current_water_level, 0), COALESCE(max_capacity_m3, 0),
	COALESCE(alert_level_m, 0), COALESCE(minor_flood_level_m, 0), COALESCE(major_flood_level_m, 0),
	gate_status, COALESCE(discharge_rate_m3s, 0),
	downstream_alert, COALESCE(alert_radius_km, 10), alert_set_at, last_updated
`

func scanDam(row pgx.Row) (*domain.DamStation, error) {
	var d domain.DamStation
	var gateStatus string
	err := row.Scan(
		&d.ID, &d.Name, &d.RiverName, &d.Location.Lat, &d.Location.Lng,
		&d.CurrentWaterLevel, &d.MaxCapacityM3,
		&d.AlertLevelM, &d.MinorFloodLevelM, &d.MajorFloodLevelM,
		&gateStatus, &d.DischargeRateM3S,
		&d.DownstreamAlert, &d.AlertRadiusKM, &d.AlertSetAt, &d.LastUpdated,
	)
	if err != nil {
		return nil, err
	}
	d.GateStatus = domain.GateStatus(gateStatus)
	return &d, nil
}

func (r *PostgresDamRepository) GetAll() ([]*domain.DamStation, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM flood_system.dam_stations
		WHERE is_active = TRUE
		ORDER BY station_name
	`, damSelectColumns)
	rows, err := r.pool.Query(context.Background(), query)
	if err != nil {
		return nil, fmt.Errorf("failed to query dam stations: %w", err)
	}
	defer rows.Close()

	var dams []*domain.DamStation
	for rows.Next() {
		d, err := scanDam(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan dam station: %w", err)
		}
		dams = append(dams, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return dams, nil
}

func (r *PostgresDamRepository) GetByID(id uuid.UUID) (*domain.DamStation, error) {
	query := fmt.Sprintf(`SELECT %s FROM flood_system.dam_stations WHERE station_id = $1`, damSelectColumns)
	d, err := scanDam(r.pool.QueryRow(context.Background(), query, id))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("dam station not found: %s", id)
		}
		return nil, fmt.Errorf("failed to fetch dam station: %w", err)
	}
	return d, nil
}

// Create inserts a new dam station added by an admin from the dashboard.
func (r *PostgresDamRepository) Create(dam *domain.DamStation) error {
	query := `
		INSERT INTO flood_system.dam_stations
			(station_id, station_name, river_name, location, current_water_level, max_capacity_m3,
			 alert_level_m, minor_flood_level_m, major_flood_level_m, gate_status, discharge_rate_m3s)
		VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8, $9, $10, $11, $12)
	`
	_, err := r.pool.Exec(context.Background(), query,
		dam.ID, dam.Name, dam.RiverName, dam.Location.Lng, dam.Location.Lat,
		dam.CurrentWaterLevel, dam.MaxCapacityM3,
		dam.AlertLevelM, dam.MinorFloodLevelM, dam.MajorFloodLevelM,
		string(dam.GateStatus), dam.DischargeRateM3S,
	)
	if err != nil {
		return fmt.Errorf("failed to create dam station: %w", err)
	}
	return nil
}

// Update overwrites every editable field of an existing dam station (admin
// "Edit" form) — everything except its downstream-alert state, which is
// managed separately via Set/ClearDownstreamAlert.
func (r *PostgresDamRepository) Update(dam *domain.DamStation) error {
	query := `
		UPDATE flood_system.dam_stations
		SET station_name = $1, river_name = $2, location = ST_SetSRID(ST_MakePoint($3, $4), 4326),
		    current_water_level = $5, max_capacity_m3 = $6,
		    alert_level_m = $7, minor_flood_level_m = $8, major_flood_level_m = $9,
		    gate_status = $10, discharge_rate_m3s = $11, last_updated = NOW()
		WHERE station_id = $12
	`
	tag, err := r.pool.Exec(context.Background(), query,
		dam.Name, dam.RiverName, dam.Location.Lng, dam.Location.Lat,
		dam.CurrentWaterLevel, dam.MaxCapacityM3,
		dam.AlertLevelM, dam.MinorFloodLevelM, dam.MajorFloodLevelM,
		string(dam.GateStatus), dam.DischargeRateM3S, dam.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update dam station: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errors.New("dam station not found")
	}
	return nil
}

func (r *PostgresDamRepository) SetDownstreamAlert(id uuid.UUID, radiusKM float64) error {
	query := `
		UPDATE flood_system.dam_stations
		SET downstream_alert = TRUE, alert_radius_km = $1, alert_set_at = NOW(), last_updated = NOW()
		WHERE station_id = $2
	`
	tag, err := r.pool.Exec(context.Background(), query, radiusKM, id)
	if err != nil {
		return fmt.Errorf("failed to set downstream alert: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errors.New("dam station not found")
	}
	return nil
}

func (r *PostgresDamRepository) ClearDownstreamAlert(id uuid.UUID) error {
	query := `
		UPDATE flood_system.dam_stations
		SET downstream_alert = FALSE, alert_set_at = NULL, last_updated = NOW()
		WHERE station_id = $1
	`
	tag, err := r.pool.Exec(context.Background(), query, id)
	if err != nil {
		return fmt.Errorf("failed to clear downstream alert: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errors.New("dam station not found")
	}
	return nil
}
