package domain

import "github.com/google/uuid"

type FloodSeverity string

const (
	SeverityNormal  FloodSeverity = "NORMAL"
	SeverityWatch   FloodSeverity = "WATCH"
	SeverityWarning FloodSeverity = "WARNING"
	SeverityExtreme FloodSeverity = "EXTREME"
)

type FloodZone struct {
	ID       uuid.UUID
	GaugeID  string
	Severity FloodSeverity
	Boundary GeoPolygon
}

// ShouldTriggerAlert returns true if severity is serious enough to alert users
func (f *FloodZone) ShouldTriggerAlert() bool {
	return f.Severity == SeverityWarning || f.Severity == SeverityExtreme
}

type FloodStatus struct {
	GaugeID  string
	Level    FloodSeverity
	Location GeoPoint
}
