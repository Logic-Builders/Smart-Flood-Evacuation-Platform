package domain

import "github.com/google/uuid"

type ReportRepository interface {
	Save(report *HazardReport) error
	GetByID(id uuid.UUID) (*HazardReport, error)
	GetPending() ([]*HazardReport, error)
	GetActive() ([]*HazardReport, error)
	UpdateStatus(id uuid.UUID, status ValidationStatus) error
}

type UserRepository interface {
	FindByEmail(email string) (*User, error)
}

type RoadRepository interface {
	FindAllPassable() ([]*RoadSegment, error)
}

type FloodZoneRepository interface {
	FindAllActive() ([]*FloodZone, error)
}
