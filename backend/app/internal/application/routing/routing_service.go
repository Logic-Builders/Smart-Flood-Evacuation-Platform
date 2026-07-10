package routing

import (
	"errors"
	"fmt"

	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/external"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories"
	"github.com/logicbuilders/flood-evacuation-backend/pkg/geo"
	"github.com/logicbuilders/flood-evacuation-backend/pkg/graph"
)

// HIGH_RISK roads (e.g. inside a WATCH-severity zone) stay routable but are
// penalized so A* strongly prefers an alternative when one exists.
const highRiskPenaltyMultiplier = 5.0

type RoutingService struct {
	floodSource   external.FloodDataSource
	roadRepo      repositories.RoadRepository
	riskEvaluator *RiskEvaluator
}

func NewRoutingService(floodSource external.FloodDataSource, roadRepo repositories.RoadRepository) *RoutingService {
	return &RoutingService{
		floodSource:   floodSource,
		roadRepo:      roadRepo,
		riskEvaluator: NewRiskEvaluator(),
	}
}

type RouteResult struct {
	Path        []string
	Coordinates [][]float64
	TotalCost   float64
}

func (s *RoutingService) GetRoute(reports []domain.HazardReport, startID, goalID string) (*RouteResult, error) {
	segments, err := s.roadRepo.GetAllSegments()
	if err != nil {
		return nil, fmt.Errorf("failed to load road segments: %w", err)
	}

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

		// BLOCKED roads (dam downstream alerts, admin flood zones/reports) are
		// skipped entirely rather than just penalized — A* must never route
		// through them. seg.Condition is written by dams.SetDownstreamAlert /
		// floodzones.CreateZone via RoadRepository.SetConditionInArea/Polygon.
		if !seg.IsPassable() {
			continue
		}

		floodRisk, err := s.floodSource.GetFloodRisk(
			seg.StartPoint.Lat,
			seg.StartPoint.Lng,
		)
		if err != nil {
			floodRisk = 0.1
		}

		segReports := filterReportsForSegment(reports, *seg)
		weight := s.riskEvaluator.ComputeWeight(*seg, floodRisk, segReports)
		if seg.Condition == domain.ConditionHighRisk {
			weight *= highRiskPenaltyMultiplier
		}

		g.AddEdge(seg.StartNodeID.String(), graph.Edge{
			To:     seg.EndNodeID.String(),
			Weight: weight,
		})
		// The demo network got bidirectionality by literally duplicating each edge in
		// both directions; real OSM-imported segments are one row per direction, so
		// add the reverse edge here unless the road is genuinely one-way.
		if !seg.IsOneWay {
			g.AddEdge(seg.EndNodeID.String(), graph.Edge{
				To:     seg.StartNodeID.String(),
				Weight: weight,
			})
		}
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
