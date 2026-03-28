package repositories

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

type PostgresReportRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresReportRepository(pool *pgxpool.Pool) *PostgresReportRepository {
	return &PostgresReportRepository{pool: pool}
}

func (r *PostgresReportRepository) Save(report *domain.HazardReport) error {
	query := `
	INSERT INTO flood_system.hazard_reports 
    (report_id, reporter_id, report_type, severity, description, status, location, submitted_at, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), $9, $10)
	`

	_, err := r.pool.Exec(context.Background(), query,
		report.ID,
		report.ReporterID,
		report.ReportType,
		report.Severity,
		report.Description,
		report.ValidationStatus,
		report.Location.Lng, // ST_MakePoint takes lng first
		report.Location.Lat,
		report.CreatedAt,
		report.ExpiresAt,
	)
	return err
}

func (r *PostgresReportRepository) GetByID(id uuid.UUID) (*domain.HazardReport, error) {
	query := `
	SELECT report_id, reporter_id, latitude, longitude, report_type,severity, description, status, created_at, expires_at
	FROM flood_system.hazard_reports
	WHERE report_id = $1
	`

	row := r.pool.QueryRow(context.Background(), query, id)
	return scnReport(row)
}

func (r *PostgresReportRepository) GetPending() ([]*domain.HazardReport, error) {
	query := `
        SELECT report_id, reporter_id, report_type, severity, description, status,
		       ST_X(location) as lng, ST_Y(location) as lat, submitted_at, expires_at
		FROM flood_system.hazard_reports
		WHERE status = 'PENDING'
		ORDER BY submitted_at DESC
    `
	rows, err := r.pool.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanReports(rows)
}

func (r *PostgresReportRepository) GetActive() ([]*domain.HazardReport, error) {
	query := `
		SELECT report_id, reporter_id, report_type, severity, description, status,
		       ST_X(location) as lng, ST_Y(location) as lat, submitted_at, expires_at
		FROM flood_system.hazard_reports
		WHERE status = 'APPROVED' AND expires_at > $1
		ORDER BY submitted_at DESC
	`

	rows, err := r.pool.Query(context.Background(), query, time.Now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanReports(rows)
}

func (r *PostgresReportRepository) UpdateStatus(id uuid.UUID, status domain.ValidationStatus) error {
	query := `
		UPDATE flood_system.hazard_reports
		SET status = $1
		WHERE report_id =$2
	`

	_, err := r.pool.Exec(context.Background(), query, status, id)
	return err
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scnReport(row rowScanner) (*domain.HazardReport, error) {
	r := &domain.HazardReport{}
	err := row.Scan(
		&r.ID,
		&r.ReporterID,
		&r.Location.Lat,
		&r.Location.Lng,
		&r.ReportType,
		&r.Severity,
		&r.Description,
		&r.ValidationStatus,
		&r.CreatedAt,
		&r.ExpiresAt,
	)
	if err != nil {
		return nil, err
	}
	return r, nil
}

func scanReports(rows interface {
	Next() bool
	Scan(...interface{}) error
	Err() error
}) ([]*domain.HazardReport, error) {
	var reports []*domain.HazardReport
	for rows.Next() {
		r := &domain.HazardReport{}
		err := rows.Scan(
			&r.ID,
			&r.ReporterID,
			&r.ReportType,
			&r.Severity,
			&r.Description,
			&r.ValidationStatus,
			&r.Location.Lng,
			&r.Location.Lat,
			&r.CreatedAt,
			&r.ExpiresAt,
		)
		if err != nil {
			return nil, err
		}
		reports = append(reports, r)
	}
	return reports, rows.Err()
}
