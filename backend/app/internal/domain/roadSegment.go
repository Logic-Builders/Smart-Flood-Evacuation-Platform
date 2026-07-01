package domain

import "github.com/google/uuid"

type RoadCondition string

const (
	ConditionSafe     RoadCondition = "PASSABLE"
	ConditionHighRisk RoadCondition = "HIGH_RISK"
	ConditionBlocked  RoadCondition = "BLOCKED"
)

type RoadSegment struct {
	ID          uuid.UUID
	StartNodeID uuid.UUID
	EndNodeID   uuid.UUID
	Distance    float64
	Condition   RoadCondition
	FloodRisk   float64
	HazardScore float64
	StartPoint  GeoPoint
	EndPoint    GeoPoint
}

func (r *RoadSegment) IsPassable() bool {
	return r.Condition != ConditionBlocked
}

// FinalWeight = α(Distance) + β(FloodRisk) + γ(HazardScore)
func (r *RoadSegment) ComputeWeight(alpha, beta, gamma float64) float64 {
	if !r.IsPassable() {
		return 999999999
	}
	return alpha*r.Distance + beta*r.FloodRisk + gamma*r.HazardScore
}
