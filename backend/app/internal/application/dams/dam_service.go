package dams

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories"
)

// DamService manages dam station readings and downstream-risk alerts. When an
// admin marks a dam as posing downstream risk, roads within the alert radius
// are automatically marked BLOCKED so routing avoids them — and reverted to
// PASSABLE when the alert is cleared.
type DamService struct {
	repo     repositories.DamRepository
	roadRepo repositories.RoadRepository
}

func NewDamService(repo repositories.DamRepository, roadRepo repositories.RoadRepository) *DamService {
	return &DamService{repo: repo, roadRepo: roadRepo}
}

func (s *DamService) GetAll() ([]*domain.DamStation, error) {
	dams, err := s.repo.GetAll()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch dam stations: %w", err)
	}
	return dams, nil
}

// DamInput carries the editable fields shared by CreateDam and UpdateDam.
type DamInput struct {
	Name              string
	RiverName         string
	Lat, Lng          float64
	CurrentWaterLevel float64
	MaxCapacityM3     float64
	AlertLevelM       float64
	MinorFloodLevelM  float64
	MajorFloodLevelM  float64
	GateStatus        domain.GateStatus
	DischargeRateM3S  float64
}

func (in DamInput) validate() error {
	if in.Name == "" {
		return fmt.Errorf("station name is required")
	}
	if in.Lat < -90 || in.Lat > 90 || in.Lng < -180 || in.Lng > 180 {
		return fmt.Errorf("invalid coordinates: lat=%f, lng=%f", in.Lat, in.Lng)
	}
	if in.CurrentWaterLevel < 0 || in.MaxCapacityM3 < 0 || in.DischargeRateM3S < 0 {
		return fmt.Errorf("levels and rates cannot be negative")
	}
	// Mirrors the DB's chk_flood_levels constraint so we return a friendly
	// error instead of a raw Postgres constraint-violation message.
	if !(in.AlertLevelM < in.MinorFloodLevelM && in.MinorFloodLevelM < in.MajorFloodLevelM) {
		return fmt.Errorf("flood thresholds must satisfy alert < minor < major")
	}
	if !isValidGateStatus(in.GateStatus) {
		return fmt.Errorf("invalid gate status: %s", in.GateStatus)
	}
	return nil
}

// CreateDam adds a new dam station (admin "Add Dam" form).
func (s *DamService) CreateDam(in DamInput) (*domain.DamStation, error) {
	if err := in.validate(); err != nil {
		return nil, err
	}
	dam := &domain.DamStation{
		ID:                uuid.New(),
		Name:              in.Name,
		RiverName:         in.RiverName,
		Location:          domain.GeoPoint{Lat: in.Lat, Lng: in.Lng},
		CurrentWaterLevel: in.CurrentWaterLevel,
		MaxCapacityM3:     in.MaxCapacityM3,
		AlertLevelM:       in.AlertLevelM,
		MinorFloodLevelM:  in.MinorFloodLevelM,
		MajorFloodLevelM:  in.MajorFloodLevelM,
		GateStatus:        in.GateStatus,
		DischargeRateM3S:  in.DischargeRateM3S,
	}
	if err := s.repo.Create(dam); err != nil {
		return nil, fmt.Errorf("failed to create dam station: %w", err)
	}
	return dam, nil
}

// UpdateDam overwrites an existing dam station's editable fields (admin
// "Edit" form). Downstream-alert state is untouched — use Set/ClearDownstreamAlert.
func (s *DamService) UpdateDam(id uuid.UUID, in DamInput) error {
	if err := in.validate(); err != nil {
		return err
	}
	dam := &domain.DamStation{
		ID:                id,
		Name:              in.Name,
		RiverName:         in.RiverName,
		Location:          domain.GeoPoint{Lat: in.Lat, Lng: in.Lng},
		CurrentWaterLevel: in.CurrentWaterLevel,
		MaxCapacityM3:     in.MaxCapacityM3,
		AlertLevelM:       in.AlertLevelM,
		MinorFloodLevelM:  in.MinorFloodLevelM,
		MajorFloodLevelM:  in.MajorFloodLevelM,
		GateStatus:        in.GateStatus,
		DischargeRateM3S:  in.DischargeRateM3S,
	}
	return s.repo.Update(dam)
}

// SetDownstreamAlert flags the dam as a downstream hazard and blocks every
// road segment within radiusKM of it.
func (s *DamService) SetDownstreamAlert(id uuid.UUID, radiusKM float64) (int, error) {
	if radiusKM <= 0 || radiusKM > 100 {
		radiusKM = 10
	}
	dam, err := s.repo.GetByID(id)
	if err != nil {
		return 0, fmt.Errorf("dam station not found: %w", err)
	}
	if err := s.repo.SetDownstreamAlert(id, radiusKM); err != nil {
		return 0, fmt.Errorf("failed to set downstream alert: %w", err)
	}
	blocked, err := s.roadRepo.SetConditionInArea(dam.Location, radiusKM, domain.ConditionBlocked)
	if err != nil {
		return 0, fmt.Errorf("alert set but failed to block roads: %w", err)
	}
	return blocked, nil
}

// ClearDownstreamAlert un-flags the dam and reverts roads in its alert radius
// back to PASSABLE.
func (s *DamService) ClearDownstreamAlert(id uuid.UUID) (int, error) {
	dam, err := s.repo.GetByID(id)
	if err != nil {
		return 0, fmt.Errorf("dam station not found: %w", err)
	}
	if err := s.repo.ClearDownstreamAlert(id); err != nil {
		return 0, fmt.Errorf("failed to clear downstream alert: %w", err)
	}
	radiusKM := dam.AlertRadiusKM
	if radiusKM <= 0 {
		radiusKM = 10
	}
	unblocked, err := s.roadRepo.SetConditionInArea(dam.Location, radiusKM, domain.ConditionSafe)
	if err != nil {
		return 0, fmt.Errorf("alert cleared but failed to reopen roads: %w", err)
	}
	return unblocked, nil
}

func isValidGateStatus(g domain.GateStatus) bool {
	switch g {
	case domain.GateClosed, domain.GatePartiallyOpen, domain.GateOpen, domain.GateEmergencyOpen:
		return true
	}
	return false
}
