package dto

// FloodZoneResponse matches the mobile app's FloodZone type
// ({id, gauge_id, severity, boundary: {coordinates}}) exactly.
type FloodZoneResponse struct {
	ID       string      `json:"id"`
	GaugeID  string      `json:"gauge_id"`
	Severity string      `json:"severity"`
	Boundary BoundaryDTO `json:"boundary"`
}

type BoundaryDTO struct {
	Coordinates []CoordDTO `json:"coordinates"`
}

type CoordDTO struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}
