package external

import (
	"math/rand"
)

type FloodDataSource interface {
	GetFloodRisk(lat, lng float64) (float64, error)
}

type MockFloodAdaptor struct{}

func NewMockFloodAdaptor() *MockFloodAdaptor {
	return &MockFloodAdaptor{}
}

func (m *MockFloodAdaptor) GetFloodRisk(lat, lng float64) (float64, error) {
	return rand.Float64(), nil //Give random risk score between 0.0 and 1.0, will be replaced by flood hub api
}
