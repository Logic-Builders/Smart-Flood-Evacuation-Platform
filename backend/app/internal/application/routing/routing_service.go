package routing

import (
	"errors"

	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/external"
	"github.com/logicbuilders/flood-evacuation-backend/pkg/geo"
	"github.com/logicbuilders/flood-evacuation-backend/pkg/graph"
)

type RoutingService struct {
	floodSource   external.FloodDataSource
	riskEvaluator *RiskEvaluator
}

func NewRoutingService(floodSource external.FloodDataSource) *RoutingService {
	return &RoutingService{
		floodSource:   floodSource,
		riskEvaluator: NewRiskEvaluator(),
	}
}

type RouteResult struct {
	Path      []string
	TotalCost float64
}

func (s *RoutingService) GetRoute(segments []domain.RoadSegment, reports []domain.HazardReport, startID, goalID string) (*RouteResult, error) {
	g := graph.NewGraph()

	for _, seg := range segments {
		g.AddNode(graph.Node{
			ID:  seg.StartNodeID.String(),
			Lat: seg.StartPoint.Lat,
			Lng: seg.StartPoint.Lng,
		})
		g.AddNode(graph.Node{
			ID:  seg.EndNodeID.String(),
			Lat: seg.EndPoint.Lat,
			Lng: seg.EndPoint.Lng,
		})

		floodRisk, err := s.floodSource.GetFloodRisk(
			seg.StartPoint.Lat,
			seg.StartPoint.Lng,
		)
		if err != nil {
			floodRisk = 0.5
		}

		segReports := filterReportsForSegment(reports, seg)
		weight := s.riskEvaluator.ComputeWeight(seg, floodRisk, segReports)

		g.AddEdge(seg.StartNodeID.String(), graph.Edge{
			To:     seg.EndNodeID.String(),
			Weight: weight,
		})
	}

	path, cost := graph.AStar(g, startID, goalID)
	if path == nil {
		return nil, errors.New("no path found between given points")
	}

	return &RouteResult{
		Path:      path,
		TotalCost: cost,
	}, nil
}

func filterReportsForSegment(reports []domain.HazardReport, seg domain.RoadSegment) []domain.HazardReport {
	var filtered []domain.HazardReport
	for _, r := range reports {
		if geo.Haversine(r.Location.Lat, r.Location.Lng, seg.StartPoint.Lat, seg.StartPoint.Lng) < 0.5 {
			filtered = append(filtered, r)
		}
	}

	return filtered
}
