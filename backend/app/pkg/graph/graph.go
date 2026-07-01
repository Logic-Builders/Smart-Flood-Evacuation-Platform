package graph

type Node struct {
	ID  string
	Lat float64
	Lng float64
}

type Edge struct {
	To     string
	Weight float64
}

type Graph struct {
	Nodes map[string]Node
	Edges map[string][]Edge
}

func NewGraph() *Graph {
	return &Graph{
		Nodes: make(map[string]Node),
		Edges: make(map[string][]Edge),
	}
}

func (g *Graph) AddNode(node Node) {
	g.Nodes[node.ID] = node
}

func (g *Graph) AddEdge(fromID string, edge Edge) {
	g.Edges[fromID] = append(g.Edges[fromID], edge)
}
