package repositories

import (
	"fmt"
	"github.com/google/uuid"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

// MockReportRepository — fake in-memory implementation
// Used during development until real DB is ready
type MockReportRepository struct {
	reports map[uuid.UUID]*domain.HazardReport
}

func NewMockReportRepository() *MockReportRepository {
	return &MockReportRepository{
		reports: make(map[uuid.UUID]*domain.HazardReport),
	}
}

func (m *MockReportRepository) Save(report *domain.HazardReport) error {
	m.reports[report.ID] = report
	return nil
}

func (m *MockReportRepository) GetByID(id uuid.UUID) (*domain.HazardReport, error) {
	report, exists := m.reports[id]
	if !exists {
		return nil, fmt.Errorf("report not found: %s", id)
	}
	return report, nil
}

func (m *MockReportRepository) GetPending() ([]*domain.HazardReport, error) {
	var pending []*domain.HazardReport
	for _, r := range m.reports {
		if r.ValidationStatus == domain.StatusPending {
			pending = append(pending, r)
		}
	}
	return pending, nil
}

func (m *MockReportRepository) GetActive() ([]*domain.HazardReport, error) {
	var active []*domain.HazardReport
	for _, r := range m.reports {
		if r.IsActive() {
			active = append(active, r)
		}
	}
	return active, nil
}

func (m *MockReportRepository) UpdateStatus(id uuid.UUID, status domain.ValidationStatus) error {
	report, exists := m.reports[id]
	if !exists {
		return fmt.Errorf("report not found: %s", id)
	}
	switch status {
	case domain.StatusApproved:
		report.Approve()
	case domain.StatusRejected:
		report.Reject()
	}
	return nil
}
