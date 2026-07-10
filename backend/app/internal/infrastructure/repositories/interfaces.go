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
	GetAllSegments() ([]*domain.RoadSegment, error)
	GetRoadsByArea(polygon domain.GeoPolygon) ([]*domain.RoadSegment, error)
	GetRoadByID(id uuid.UUID) (*domain.RoadSegment, error)
	UpdateRoadWeight(id uuid.UUID, floodRisk float64, hazardScore float64) error
	NearestNodeID(lat, lng float64) (uuid.UUID, error)
	NodeCoords(nodeID uuid.UUID) (lat, lng float64, err error)
	GetNetworkForMap() (nodes, segments []map[string]interface{}, err error)
	// SetConditionInArea bulk-updates the condition of every segment whose
	// geometry intersects the given circle (center + radius), returning how
	// many rows changed. Used to auto-block/unblock roads near a hazard.
	SetConditionInArea(center domain.GeoPoint, radiusKM float64, condition domain.RoadCondition) (int, error)
	// SetConditionInPolygon is the arbitrary-polygon equivalent, used for
	// flood zones (which aren't always circles).
	SetConditionInPolygon(polygon domain.GeoPolygon, condition domain.RoadCondition) (int, error)
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
	// DeactivateZone soft-deletes the zone and returns its boundary so the
	// caller can revert any roads that were auto-blocked because of it.
	DeactivateZone(id uuid.UUID) (domain.GeoPolygon, error)
	// CreateZone adds a flood warning as a circular zone (center + radius)
	// rather than requiring admins to draw a polygon. gaugeID/dataSource let
	// the Flood Hub poller tag zones it created (vs. "" for manual entries).
	CreateZone(zoneName string, severity domain.FloodSeverity, center domain.GeoPoint, radiusKM float64, gaugeID, dataSource string) (*domain.FloodZone, error)
	// FindActiveZoneByGauge returns the ID of the current active zone for a
	// gauge, if any — used by the Flood Hub poller to avoid creating
	// duplicate zones on every poll and to find its own zone to clear.
	FindActiveZoneByGauge(gaugeID string) (uuid.UUID, error)
}

// WeatherRepository — manually-entered rainfall/weather readings
type WeatherRepository interface {
	Save(reading *domain.WeatherReading) error
	GetRecent(limit int) ([]*domain.WeatherReading, error)
}

// DamRepository — dam station monitoring and downstream-risk alerts
type DamRepository interface {
	GetAll() ([]*domain.DamStation, error)
	GetByID(id uuid.UUID) (*domain.DamStation, error)
	Create(dam *domain.DamStation) error
	Update(dam *domain.DamStation) error
	SetDownstreamAlert(id uuid.UUID, radiusKM float64) error
	ClearDownstreamAlert(id uuid.UUID) error
}
