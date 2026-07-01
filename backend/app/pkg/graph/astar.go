package graph

import (
	"container/heap"
	"math"

	"github.com/logicbuilders/flood-evacuation-backend/pkg/geo"
)

// priority queue item
type Item struct {
	nodeID string
	fScore float64
	index  int
}

// priority queue implementation
type PriorityQueue []*Item

func (pq PriorityQueue) Len() int { return len(pq) }

func (pq PriorityQueue) Less(i, j int) bool {
	return pq[i].fScore < pq[j].fScore
}

func (pq PriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}

func (pq *PriorityQueue) Push(x interface{}) {
	n := len(*pq)
	item := x.(*Item)
	item.index = n
	*pq = append(*pq, item)
}

func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	item := old[n-1]
	item.index = -1
	*pq = old[:n-1]
	return item
}

// heuristic - straight line distance to goal
func heuristic(a, b Node) float64 {
	return geo.Haversine(a.Lat, a.Lng, b.Lat, b.Lng)
}

// Astar finds the safest path from startID to goalID
func AStar(g *Graph, startID, goalID string) ([]string, float64) {
	startNode, ok := g.Nodes[startID]
	if !ok {
		return nil, 0
	}
	goalNode, ok := g.Nodes[goalID]
	if !ok {
		return nil, 0
	}

	gScore := make(map[string]float64) //actual cost to reach this node from start
	gScore[startID] = 0

	fScore := make(map[string]float64) //total cose through this node(gScore+heuristic)
	fScore[startID] = heuristic(startNode, goalNode)

	cameFrom := make(map[string]string)

	pq := &PriorityQueue{}
	heap.Init(pq)
	heap.Push(pq, &Item{nodeID: startID, fScore: fScore[startID]})

	closed := make(map[string]bool)

	for pq.Len() > 0 {
		current := heap.Pop(pq).(*Item).nodeID

		if current == goalID {
			return reconstructPath(cameFrom, current), gScore[goalID]
		}

		if closed[current] {
			continue
		}
		closed[current] = true

		for _, edge := range g.Edges[current] {
			if closed[edge.To] {
				continue
			}

			tentativeG := gScore[current] + edge.Weight

			existinG, exists := gScore[edge.To]
			if !exists {
				existinG = math.MaxFloat64
			}

			if tentativeG < existinG {
				cameFrom[edge.To] = current
				gScore[edge.To] = tentativeG
				fScore[edge.To] = tentativeG + heuristic(g.Nodes[edge.To], goalNode)
				heap.Push(pq, &Item{nodeID: edge.To, fScore: fScore[edge.To]})
			}
		}
	}

	return nil, 0
}

func reconstructPath(cameFrom map[string]string, current string) []string {
	path := []string{current}
	for {
		prev, ok := cameFrom[current]
		if !ok {
			break
		}
		path = append([]string{prev}, path...)
		current = prev
	}
	return path
}
