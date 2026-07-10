package floodzones

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories"
)

// FloodZoneService handles business logic for active flood risk zones. When a
// zone is created it auto-blocks intersecting roads (severity-dependent), and
// reopens them when the zone is deactivated.
type FloodZoneService struct {
	repo     repositories.FloodDataSource
	roadRepo repositories.RoadRepository
}

func NewFloodZoneService(repo repositories.FloodDataSource, roadRepo repositories.RoadRepository) *FloodZoneService {
	return &FloodZoneService{repo: repo, roadRepo: roadRepo}
}

// GetActiveZones returns all currently active flood risk zones.
func (s *FloodZoneService) GetActiveZones() ([]*domain.FloodZone, error) {
	zones, err := s.repo.GetFloodZones(domain.GeoPolygon{})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch active flood zones: %w", err)
	}
	return zones, nil
}

// CreateZone adds a manually-entered flood warning (dashboard admin, center +
// radius) and blocks roads inside it if the severity warrants it: EXTREME/
// WARNING block the road outright, WATCH marks it high-risk (still routable,
// but penalized), NORMAL leaves roads untouched.
func (s *FloodZoneService) CreateZone(zoneName string, severity domain.FloodSeverity, lat, lng, radiusKM float64) (*domain.FloodZone, int, error) {
	return s.createZone(zoneName, severity, lat, lng, radiusKM, "", "")
}

// CreateAutoZone is the same as CreateZone but tags the zone with a gaugeID +
// data source, so the Flood Hub poller can find it again on later polls
// instead of creating a duplicate. See floodhub.Poller.
func (s *FloodZoneService) CreateAutoZone(zoneName string, severity domain.FloodSeverity, lat, lng, radiusKM float64, gaugeID string) (*domain.FloodZone, int, error) {
	return s.createZone(zoneName, severity, lat, lng, radiusKM, gaugeID, "Google Flood Hub")
}

func (s *FloodZoneService) createZone(zoneName string, severity domain.FloodSeverity, lat, lng, radiusKM float64, gaugeID, dataSource string) (*domain.FloodZone, int, error) {
	if !isValidSeverity(severity) {
		return nil, 0, fmt.Errorf("invalid severity: %s", severity)
	}
	if radiusKM <= 0 || radiusKM > 100 {
		return nil, 0, fmt.Errorf("radius must be between 0 and 100 km")
	}
	if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return nil, 0, fmt.Errorf("invalid coordinates: lat=%f, lng=%f", lat, lng)
	}

	zone, err := s.repo.CreateZone(zoneName, severity, domain.GeoPoint{Lat: lat, Lng: lng}, radiusKM, gaugeID, dataSource)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create flood zone: %w", err)
	}

	condition, shouldBlock := conditionForSeverity(severity)
	if !shouldBlock {
		return zone, 0, nil
	}
	affected, err := s.roadRepo.SetConditionInPolygon(zone.Boundary, condition)
	if err != nil {
		return zone, 0, fmt.Errorf("zone created but failed to update road conditions: %w", err)
	}
	return zone, affected, nil
}

// HasActiveZoneForGauge reports whether a gauge already has an active zone,
// so the poller doesn't create duplicates on every poll cycle.
func (s *FloodZoneService) HasActiveZoneForGauge(gaugeID string) bool {
	_, err := s.repo.FindActiveZoneByGauge(gaugeID)
	return err == nil
}

// DeactivateZoneByGauge finds and deactivates a gauge's active zone (e.g.
// when the poller sees the gauge has returned to NORMAL/WATCH).
func (s *FloodZoneService) DeactivateZoneByGauge(gaugeID string) (int, error) {
	id, err := s.repo.FindActiveZoneByGauge(gaugeID)
	if err != nil {
		return 0, err
	}
	return s.DeactivateZone(id)
}

// DeactivateZone removes a flood zone from the active set (e.g. an admin
// clearing it from the map once conditions have subsided) and reverts any
// roads that were auto-blocked because of it back to PASSABLE.
func (s *FloodZoneService) DeactivateZone(id uuid.UUID) (int, error) {
	boundary, err := s.repo.DeactivateZone(id)
	if err != nil {
		return 0, fmt.Errorf("failed to deactivate flood zone: %w", err)
	}
	if len(boundary.Coordinates) < 3 {
		return 0, nil
	}
	reopened, err := s.roadRepo.SetConditionInPolygon(boundary, domain.ConditionSafe)
	if err != nil {
		return 0, fmt.Errorf("zone deactivated but failed to reopen roads: %w", err)
	}
	return reopened, nil
}

func conditionForSeverity(s domain.FloodSeverity) (domain.RoadCondition, bool) {
	switch s {
	case domain.SeverityExtreme, domain.SeverityWarning:
		return domain.ConditionBlocked, true
	case domain.SeverityWatch:
		return domain.ConditionHighRisk, true
	default:
		return domain.ConditionSafe, false
	}
}

func isValidSeverity(s domain.FloodSeverity) bool {
	switch s {
	case domain.SeverityNormal, domain.SeverityWatch, domain.SeverityWarning, domain.SeverityExtreme:
		return true
	}
	return false
}
