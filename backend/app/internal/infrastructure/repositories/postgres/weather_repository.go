package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

// PostgresWeatherRepository stores manually-entered rainfall/weather readings
// (dashboard "Add New Data Point" form) in the weather_data table.
type PostgresWeatherRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresWeatherRepository(pool *pgxpool.Pool) *PostgresWeatherRepository {
	return &PostgresWeatherRepository{pool: pool}
}

func (r *PostgresWeatherRepository) Save(reading *domain.WeatherReading) error {
	query := `
		INSERT INTO flood_system.weather_data
			(weather_id, station_name, district, rainfall_mm, risk_level, notes, forecast_time, recorded_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
	`
	_, err := r.pool.Exec(context.Background(), query,
		reading.ID, reading.StationName, reading.District, reading.RainfallMM,
		string(reading.RiskLevel), reading.Notes, reading.RecordedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to save weather reading: %w", err)
	}
	return nil
}

func (r *PostgresWeatherRepository) GetRecent(limit int) ([]*domain.WeatherReading, error) {
	query := `
		SELECT weather_id, COALESCE(station_name, ''), COALESCE(district, ''),
		       COALESCE(rainfall_mm, 0), COALESCE(risk_level::text, 'NORMAL'), COALESCE(notes, ''), recorded_at
		FROM flood_system.weather_data
		ORDER BY recorded_at DESC
		LIMIT $1
	`
	rows, err := r.pool.Query(context.Background(), query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query weather readings: %w", err)
	}
	defer rows.Close()

	var readings []*domain.WeatherReading
	for rows.Next() {
		var w domain.WeatherReading
		var riskLevel string
		if err := rows.Scan(&w.ID, &w.StationName, &w.District, &w.RainfallMM, &riskLevel, &w.Notes, &w.RecordedAt); err != nil {
			return nil, fmt.Errorf("failed to scan weather reading: %w", err)
		}
		w.RiskLevel = domain.FloodSeverity(riskLevel)
		readings = append(readings, &w)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return readings, nil
}
