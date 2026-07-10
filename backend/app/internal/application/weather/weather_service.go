package weather

import (
	"fmt"

	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories"
)

type WeatherService struct {
	repo repositories.WeatherRepository
}

func NewWeatherService(repo repositories.WeatherRepository) *WeatherService {
	return &WeatherService{repo: repo}
}

func (s *WeatherService) RecordReading(stationName, district string, rainfallMM float64, riskLevel domain.FloodSeverity, notes string) (*domain.WeatherReading, error) {
	if stationName == "" {
		return nil, fmt.Errorf("station/source name is required")
	}
	if !isValidSeverity(riskLevel) {
		return nil, fmt.Errorf("invalid risk level: %s", riskLevel)
	}

	reading := domain.NewWeatherReading(stationName, district, rainfallMM, riskLevel, notes)
	if err := s.repo.Save(reading); err != nil {
		return nil, fmt.Errorf("failed to save weather reading: %w", err)
	}
	return reading, nil
}

func (s *WeatherService) GetRecent(limit int) ([]*domain.WeatherReading, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	readings, err := s.repo.GetRecent(limit)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch weather readings: %w", err)
	}
	return readings, nil
}

func isValidSeverity(s domain.FloodSeverity) bool {
	switch s {
	case domain.SeverityNormal, domain.SeverityWatch, domain.SeverityWarning, domain.SeverityExtreme:
		return true
	}
	return false
}
