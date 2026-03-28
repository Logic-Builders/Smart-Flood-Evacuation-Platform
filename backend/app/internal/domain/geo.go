package domain

// GeoPoint represents a location on a map
type GeoPoint struct {
	Lat float64
	Lng float64
}

// GeoPolygon represents a shape on a map (e.g. a flood zone boundary)
type GeoPolygon struct {
	Coordinates []GeoPoint
}
