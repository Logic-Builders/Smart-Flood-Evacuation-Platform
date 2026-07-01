package repositories

import (
	"github.com/google/uuid"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

// ReportRepository — Database implements this with real SQL
type ReportRepository interface {
	Save(report *domain.HazardReport) error
	GetByID(id uuid.UUID) (*domain.HazardReport, error)
	GetPending() ([]*domain.HazardReport, error)
	GetActive() ([]*domain.HazardReport, error)
	UpdateStatus(id uuid.UUID, status domain.ValidationStatus) error
}

// RoadRepository — roads and their current risk weights
type RoadRepository interface {
	GetRoadsByArea(polygon domain.GeoPolygon) ([]*domain.RoadSegment, error)
	GetRoadByID(id uuid.UUID) (*domain.RoadSegment, error)
	UpdateRoadWeight(id uuid.UUID, floodRisk float64, hazardScore float64) error
}

// UserRepository — user management
type UserRepository interface {
	Save(user *domain.User) error
	GetByID(id uuid.UUID) (*domain.User, error)
	GetByEmail(email string) (*domain.User, error)
}

// FloodDataSource — Google Flood Hub API or mock
type FloodDataSource interface {
	GetFloodZones(region domain.GeoPolygon) ([]*domain.FloodZone, error)
	GetFloodStatus(gaugeID string) (*domain.FloodStatus, error)
}
