package reports

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories"
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

//GetReport fetches a single report by ID

func (s *ReportService) GetReport(id uuid.UUID) (*domain.HazardReport, error) {
	report, err := s.repo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("report not found: %w", err)
	}
	return report, nil
}

//GetPendingReports returns all reports waiting for admin review

func (s *ReportService) GetPendingReports() ([]*domain.HazardReport, error) {
	reports, err := s.repo.GetPending()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch pending reports: %w", err)
	}
	return reports, nil
}

//GetActiveReports returns all approved non-expired reports
//These are the reports that affect routing

func (s *ReportService) GetActiveReports() ([]*domain.HazardReport, error) {
	reports, err := s.repo.GetActive()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch active reports: %w", err)
	}
	return reports, nil
}

//ApproveReport is calle by admin to approve a pending trport.

func (s *ReportService) ApproveReport(reportID uuid.UUID) error {
	report, err := s.repo.GetByID(reportID)
	if err != nil {
		return fmt.Errorf("report not found: %w", err)
	}

	//Only pending reports can be approved
	if report.ValidationStatus != domain.StatusPending {
		return fmt.Errorf("report is not pending, current status: %s", report.ValidationStatus)
	}

	return s.repo.UpdateStatus(reportID, domain.StatusApproved)
}

// RejectReport is called by admin to reject a pending report
func (s *ReportService) RejectReport(reportID uuid.UUID) error {
	report, err := s.repo.GetByID(reportID)
	if err != nil {
		return fmt.Errorf("report not found: %w", err)
	}

	if report.ValidationStatus != domain.StatusPending {
		return fmt.Errorf("report is not pending, current status: %s", report.ValidationStatus)
	}

	return s.repo.UpdateStatus(reportID, domain.StatusRejected)
}

func isValidReportType(rt domain.ReportType) bool {
	switch rt {
	case domain.ReportTypeFloodedRoad,
		domain.ReportTypeDamagedBridge,
		domain.ReportTypeBlockedRoad:
		return true
	}
	return false
}
