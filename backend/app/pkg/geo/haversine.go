package geo

import "math"

const earthRadiusKm = 6371.0

func toRadians(deg float64) float64 {
	return deg * math.Pi / 180
}

func Haversine(lat1, lng1, lat2, lng2 float64) float64 {
	dLat := toRadians(lat2 - lat1)
	dLng := toRadians(lng2 - lng1)

	lat1 = toRadians(lat1)
	lat2 = toRadians(lat2)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(lat1)*math.Cos(lat2)*math.Sin(dLng/2)*math.Sin(dLng/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusKm * c
}
