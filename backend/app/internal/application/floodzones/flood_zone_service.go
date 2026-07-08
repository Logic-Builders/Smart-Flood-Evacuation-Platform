package floodzones

import (
	"fmt"

	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories"
)

// FloodZoneService handles business logic for active flood risk zones.
type FloodZoneService struct {
	repo repositories.FloodDataSource
}

func NewFloodZoneService(repo repositories.FloodDataSource) *FloodZoneService {
	return &FloodZoneService{repo: repo}
}

// GetActiveZones returns all currently active flood risk zones.
func (s *FloodZoneService) GetActiveZones() ([]*domain.FloodZone, error) {
	zones, err := s.repo.GetFloodZones(domain.GeoPolygon{})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch active flood zones: %w", err)
	}
	return zones, nil
}
