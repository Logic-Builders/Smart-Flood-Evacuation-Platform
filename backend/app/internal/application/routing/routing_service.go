package routing

import (
	"errors"

	"github.com/logicbuilders/flood-evacuation-backend/pkg/graph"
)

type RoutingService struct {
	graph *graph.Graph
}

func NewRoutingService() *RoutingService {
	g := graph.NewGraph()

	//mock road network - need to replace with DB
	g.AddNode(graph.Node{ID: "A", Lat: 6.9271, Lng: 79.8612})
	g.AddNode(graph.Node{ID: "B", Lat: 6.9376, Lng: 79.8502})
	g.AddNode(graph.Node{ID: "C", Lat: 6.9401, Lng: 79.8700})
	g.AddNode(graph.Node{ID: "D", Lat: 6.9450, Lng: 79.8550})

	g.AddEdge("A", graph.Edge{To: "B", Weight: 1.5})
	g.AddEdge("A", graph.Edge{To: "C", Weight: 3.0})
	g.AddEdge("B", graph.Edge{To: "D", Weight: 1.0})
	g.AddEdge("C", graph.Edge{To: "D", Weight: 2.0})

	return &RoutingService{graph: g}
}

type RouteResult struct {
	Path      []string
	TotalCost float64
}

func (s *RoutingService) GetRoute(startID, goalID string) (*RouteResult, error) {
	path, cost := graph.AStar(s.graph, startID, goalID)
	if path == nil {
		return nil, errors.New("no path found between given points")
	}

	return &RouteResult{
		Path:      path,
		TotalCost: cost,
	}, nil
}
