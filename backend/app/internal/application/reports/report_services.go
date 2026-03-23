package reports

import (
	"fmt"

	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories"
	"githun.com/google/uuid"
)

// Report service handles all the business logic for hazard reports
type ReportService struct {
	repo repositories.ReportRepository
}

func NewReportService(repo repositories.ReportRepository) *ReportService {
	return &ReportService{repo: repo}
}

// Submit report validates and saves a new hazard report
func (s *ReportService) SubmitReport(
	reporterID uuid.UUID,
	lat, lng float64,
	reportType domain.ReportType,
	severity int,
	description string,
) (*domain.HazardReport, error) {

	//Validates severity
	if severity < 1 || severity > 5 {
		return nil, fmt.Errorf("severity must be between 1 and 5, got %d", severity)
	}

	//Validate location
	if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return nil, fmt.Errorf("invalid coordinates: lat=%f, lng=%f", lat, lng)
	}

	//Validate report type
	if !isValidReportType(reportType) {
		return nil, fmt.Errorf("invalid report type: %s", reportType)
	}

	//create the domain object
	location := domain.GeoPoint{Latitude: lat, Longitude: lng}
	report := domain.NewHazardReport(reporterID, location, reportType, severity, description)

	//Save via repository
	if err := s.repo.Save(report); err != nil {
		return nil, fmt.Errorf("failed to save report: %w", err)
	}

	return report, nil
}
