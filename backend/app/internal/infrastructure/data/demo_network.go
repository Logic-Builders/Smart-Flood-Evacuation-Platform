package data

import (
	"fmt"
	"math"

	"github.com/google/uuid"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/pkg/geo"
)

// Demo road network around Ampara District for local MVP (no PostGIS required).
var demoNodes = []struct {
	id  uuid.UUID
	lat float64
	lng float64
}{
	{id: uuid.MustParse("00000000-0000-0000-0000-000000000001"), lat: 7.290, lng: 81.665},
	{id: uuid.MustParse("00000000-0000-0000-0000-000000000002"), lat: 7.297, lng: 81.672},
	{id: uuid.MustParse("00000000-0000-0000-0000-000000000003"), lat: 7.304, lng: 81.679},
	{id: uuid.MustParse("00000000-0000-0000-0000-000000000004"), lat: 7.290, lng: 81.679},
	{id: uuid.MustParse("00000000-0000-0000-0000-000000000005"), lat: 7.297, lng: 81.686},
	{id: uuid.MustParse("00000000-0000-0000-0000-000000000006"), lat: 7.304, lng: 81.693},
	{id: uuid.MustParse("00000000-0000-0000-0000-000000000007"), lat: 7.283, lng: 81.672},
	{id: uuid.MustParse("00000000-0000-0000-0000-000000000008"), lat: 7.311, lng: 81.672},
}

var demoEdges = [][2]int{
	{0, 1}, {1, 2}, {0, 3}, {1, 4}, {2, 5}, {3, 4}, {4, 5},
	{6, 1}, {1, 7}, {6, 7},
}

func GetDemoSegments() []domain.RoadSegment {
	var segments []domain.RoadSegment
	for i, edge := range demoEdges {
		a := demoNodes[edge[0]]
		b := demoNodes[edge[1]]
		dist := geo.Haversine(a.lat, a.lng, b.lat, b.lng)
		segments = append(segments, domain.RoadSegment{
			ID:          uuid.MustParse(fmt.Sprintf("10000000-0000-0000-0000-%012d", i)),
			StartNodeID: a.id,
			EndNodeID:   b.id,
			Distance:    dist,
			Condition:   domain.ConditionSafe,
			StartPoint:  domain.GeoPoint{Lat: a.lat, Lng: a.lng},
			EndPoint:    domain.GeoPoint{Lat: b.lat, Lng: b.lng},
		})
		segments = append(segments, domain.RoadSegment{
			ID:          uuid.MustParse(fmt.Sprintf("20000000-0000-0000-0000-%012d", i)),
			StartNodeID: b.id,
			EndNodeID:   a.id,
			Distance:    dist,
			Condition:   domain.ConditionSafe,
			StartPoint:  domain.GeoPoint{Lat: b.lat, Lng: b.lng},
			EndPoint:    domain.GeoPoint{Lat: a.lat, Lng: a.lng},
		})
	}
	return segments
}

func GetDemoNodes() []map[string]interface{} {
	out := make([]map[string]interface{}, len(demoNodes))
	for i, n := range demoNodes {
		out[i] = map[string]interface{}{
			"id":  n.id.String(),
			"lat": n.lat,
			"lng": n.lng,
		}
	}
	return out
}

func NearestNode(lat, lng float64) string {
	bestID := demoNodes[0].id.String()
	bestDist := math.MaxFloat64
	for _, n := range demoNodes {
		d := geo.Haversine(lat, lng, n.lat, n.lng)
		if d < bestDist {
			bestDist = d
			bestID = n.id.String()
		}
	}
	return bestID
}

func NodeCoords(nodeID string) (float64, float64, bool) {
	for _, n := range demoNodes {
		if n.id.String() == nodeID {
			return n.lat, n.lng, true
		}
	}
	return 0, 0, false
}

func SegmentsForMap() []map[string]interface{} {
	segments := GetDemoSegments()
	out := make([]map[string]interface{}, 0, len(segments))
	for _, s := range segments {
		out = append(out, map[string]interface{}{
			"start": []float64{s.StartPoint.Lat, s.StartPoint.Lng},
			"end":   []float64{s.EndPoint.Lat, s.EndPoint.Lng},
		})
	}
	return out
}
