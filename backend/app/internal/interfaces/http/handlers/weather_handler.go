package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/weather"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

type WeatherHandler struct {
	service *weather.WeatherService
}

func NewWeatherHandler(service *weather.WeatherService) *WeatherHandler {
	return &WeatherHandler{service: service}
}

type recordWeatherRequest struct {
	Source     string  `json:"source" binding:"required"`
	District   string  `json:"district"`
	RainfallMM float64 `json:"rainfall_mm"`
	RiskLevel  string  `json:"risk_level" binding:"required"`
	Notes      string  `json:"notes"`
}

// GetRecent handles GET /api/v1/weather
func (h *WeatherHandler) GetRecent(c *gin.Context) {
	readings, err := h.service.GetRecent(50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	response := make([]gin.H, 0, len(readings))
	for _, w := range readings {
		response = append(response, gin.H{
			"id":          w.ID.String(),
			"source":      w.StationName,
			"district":    w.District,
			"rainfall_mm": w.RainfallMM,
			"risk_level":  string(w.RiskLevel),
			"notes":       w.Notes,
			"recorded_at": w.RecordedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"readings": response}})
}

// Record handles POST /api/v1/admin/weather
func (h *WeatherHandler) Record(c *gin.Context) {
	var req recordWeatherRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	reading, err := h.service.RecordReading(req.Source, req.District, req.RainfallMM, domain.FloodSeverity(req.RiskLevel), req.Notes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"id":          reading.ID.String(),
			"source":      reading.StationName,
			"district":    reading.District,
			"rainfall_mm": reading.RainfallMM,
			"risk_level":  string(reading.RiskLevel),
			"notes":       reading.Notes,
			"recorded_at": reading.RecordedAt,
		},
	})
}
