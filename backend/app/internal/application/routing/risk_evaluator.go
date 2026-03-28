package routing

import (
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/pkg/geo"
)

const (
	alphaDistance    = 0.2
	betaFloodRisk    = 0.3 //comes from floodhub api and for now use mockdata
	gammaHazardScore = 0.5
)

type RiskEvaluator struct{}

func NewRiskEvaluator() *RiskEvaluator {
	return &RiskEvaluator{}
}

func (r *RiskEvaluator) ComputeWeight(segment domain.RoadSegment, floodRisk float64, reports []domain.HazardReport) float64 {
	distance := geo.Haversine(
		segment.StartPoint.Lat,
		segment.StartPoint.Lng,
		segment.EndPoint.Lat,
		segment.EndPoint.Lng,
	)

	hazardScore := r.computeHazardScore(reports)

	weight := (alphaDistance * distance) + (betaFloodRisk * floodRisk) + (gammaHazardScore * hazardScore)

	return weight
}

func (r *RiskEvaluator) computeHazardScore(reports []domain.HazardReport) float64 {
	if len(reports) == 0 {
		return 0.0
	}

	activeCount := 0
	for _, report := range reports {
		if report.IsActive() {
			activeCount++
		}
	}

	score := float64(activeCount) / float64(len(reports))
	if score > 1.0 {
		return 1.0
	}

	return score
}
