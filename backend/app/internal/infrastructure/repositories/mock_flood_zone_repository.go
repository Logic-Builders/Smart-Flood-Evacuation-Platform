package repositories

import (
	"github.com/google/uuid"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

type MockFloodZoneRepository struct{}

func NewMockFloodZoneRepository() *MockFloodZoneRepository {
	return &MockFloodZoneRepository{}
}

func (r *MockFloodZoneRepository) FindAllActive() ([]*domain.FloodZone, error) {
	return []*domain.FloodZone{
		{
			ID:       uuid.MustParse("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
			GaugeID:  "GAUGE-KELANI-001",
			Severity: domain.SeverityWarning,
			Boundary: domain.GeoPolygon{
				Coordinates: []domain.GeoPoint{
					{Lat: 6.95, Lng: 79.98},
					{Lat: 6.95, Lng: 80.05},
					{Lat: 7.02, Lng: 80.05},
					{Lat: 7.02, Lng: 79.98},
					{Lat: 6.95, Lng: 79.98},
				},
			},
		},
	}, nil
}
