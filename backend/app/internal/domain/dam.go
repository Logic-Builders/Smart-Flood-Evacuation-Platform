package domain

import (
	"time"

	"github.com/google/uuid"
)

type GateStatus string

const (
	GateClosed        GateStatus = "CLOSED"
	GatePartiallyOpen GateStatus = "PARTIALLY_OPEN"
	GateOpen          GateStatus = "OPEN"
	GateEmergencyOpen GateStatus = "EMERGENCY_OPEN"
)

type DamStation struct {
	ID                uuid.UUID
	Name              string
	RiverName         string
	Location          GeoPoint
	CurrentWaterLevel float64
	MaxCapacityM3     float64
	AlertLevelM       float64
	MinorFloodLevelM  float64
	MajorFloodLevelM  float64
	GateStatus        GateStatus
	DischargeRateM3S  float64
	DownstreamAlert   bool
	AlertRadiusKM     float64
	AlertSetAt        *time.Time
	LastUpdated       time.Time
}

// RiskRatio expresses current water level relative to the major flood
// threshold, e.g. 0.9 = 90% of the way to a major flood. Used by the
// dashboard to render a capacity/risk bar without re-deriving it client-side.
func (d *DamStation) RiskRatio() float64 {
	if d.MajorFloodLevelM <= 0 {
		return 0
	}
	ratio := d.CurrentWaterLevel / d.MajorFloodLevelM
	if ratio > 1.5 {
		return 1.5
	}
	return ratio
}
