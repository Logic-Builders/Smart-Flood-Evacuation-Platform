package domain

import (
	"time"

	"github.com/google/uuid"
)

type WeatherReading struct {
	ID          uuid.UUID
	StationName string
	District    string
	RainfallMM  float64
	RiskLevel   FloodSeverity
	Notes       string
	RecordedAt  time.Time
}

func NewWeatherReading(stationName, district string, rainfallMM float64, riskLevel FloodSeverity, notes string) *WeatherReading {
	return &WeatherReading{
		ID:          uuid.New(),
		StationName: stationName,
		District:    district,
		RainfallMM:  rainfallMM,
		RiskLevel:   riskLevel,
		Notes:       notes,
		RecordedAt:  time.Now(),
	}
}
