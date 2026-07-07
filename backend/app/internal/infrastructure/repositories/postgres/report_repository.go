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

// PostgresReportRepository implements repositories.ReportRepository
// using a real PostgreSQL/PostGIS backend instead of the in-memory mock.
type PostgresReportRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresReportRepository(pool *pgxpool.Pool) *PostgresReportRepository {
	return &PostgresReportRepository{pool: pool}
}

// Save inserts a new hazard report.
// location is stored as PostGIS geometry via ST_SetSRID(ST_MakePoint(lng, lat), 4326).
func (r *PostgresReportRepository) Save(report *domain.HazardReport) error {
	query := `
		INSERT INTO flood_system.hazard_reports
			(report_id, reporter_id, report_type, status, location, severity, description, submitted_at, expires_at)
		VALUES
			($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9, $10)
	`
	_, err := r.pool.Exec(context.Background(), query,
		report.ID,
		report.ReporterID,
		report.ReportType,
		report.ValidationStatus,
		report.Location.Lng, // lng first — matches ST_MakePoint(lng, lat) convention used in database.sql
		report.Location.Lat,
		report.Severity,
		report.Description,
		report.CreatedAt,
		report.ExpiresAt,
	)
	if err != nil {
		return fmt.Errorf("failed to save hazard report: %w", err)
	}
	return nil
}

// GetByID fetches a single report by its ID.
func (r *PostgresReportRepository) GetByID(id uuid.UUID) (*domain.HazardReport, error) {
	query := `
		SELECT report_id, reporter_id, report_type, status,
		       ST_Y(location) AS lat, ST_X(location) AS lng,
		       severity, description, submitted_at, expires_at
		FROM flood_system.hazard_reports
		WHERE report_id = $1
	`
	row := r.pool.QueryRow(context.Background(), query, id)
	return scanReport(row)
}

// GetPending fetches all reports awaiting admin review.
func (r *PostgresReportRepository) GetPending() ([]*domain.HazardReport, error) {
	query := `
		SELECT report_id, reporter_id, report_type, status,
		       ST_Y(location) AS lat, ST_X(location) AS lng,
		       severity, description, submitted_at, expires_at
		FROM flood_system.hazard_reports
		WHERE status = 'PENDING'
		ORDER BY submitted_at ASC
	`
	return queryReports(r.pool, query)
}

// GetActive fetches all approved, non-expired reports.
func (r *PostgresReportRepository) GetActive() ([]*domain.HazardReport, error) {
	query := `
		SELECT report_id, reporter_id, report_type, status,
		       ST_Y(location) AS lat, ST_X(location) AS lng,
		       severity, description, submitted_at, expires_at
		FROM flood_system.hazard_reports
		WHERE status = 'APPROVED' AND expires_at > NOW()
		ORDER BY submitted_at DESC
	`
	return queryReports(r.pool, query)
}

// UpdateStatus updates a report's validation status (e.g. approve/reject).
func (r *PostgresReportRepository) UpdateStatus(id uuid.UUID, status domain.ValidationStatus) error {
	query := `
		UPDATE flood_system.hazard_reports
		SET status = $1
		WHERE report_id = $2
	`
	tag, err := r.pool.Exec(context.Background(), query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update report status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errors.New("report not found")
	}
	return nil
}

// --- helpers ---

type rowScanner interface {
	Scan(dest ...any) error
}

func scanReport(row rowScanner) (*domain.HazardReport, error) {
	var rep domain.HazardReport
	var lat, lng float64

	err := row.Scan(
		&rep.ID,
		&rep.ReporterID,
		&rep.ReportType,
		&rep.ValidationStatus,
		&lat,
		&lng,
		&rep.Severity,
		&rep.Description,
		&rep.CreatedAt,
		&rep.ExpiresAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("report not found")
		}
		return nil, fmt.Errorf("failed to scan hazard report: %w", err)
	}

	rep.Location = domain.GeoPoint{Lat: lat, Lng: lng}
	return &rep, nil
}

func queryReports(pool *pgxpool.Pool, query string, args ...any) ([]*domain.HazardReport, error) {
	rows, err := pool.Query(context.Background(), query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query hazard reports: %w", err)
	}
	defer rows.Close()

	var reports []*domain.HazardReport
	for rows.Next() {
		rep, err := scanReport(rows)
		if err != nil {
			return nil, err
		}
		reports = append(reports, rep)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return reports, nil
}