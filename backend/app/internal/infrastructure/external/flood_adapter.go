package external

type FloodDataSource interface {	GetFloodRisk(lat, lng float64) (float64, error)
}

type MockFloodAdaptor struct{}

func NewMockFloodAdaptor() *MockFloodAdaptor {
	return &MockFloodAdaptor{}
}

func (m *MockFloodAdaptor) GetFloodRisk(lat, lng float64) (float64, error) {
	// Deterministic low baseline for stable MVP demos
	return 0.1, nil
}
