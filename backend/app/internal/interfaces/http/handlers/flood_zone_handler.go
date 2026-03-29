package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

type FloodZoneHandler struct {
	repo domain.FloodZoneRepository
}

func NewFloodZoneHandler(repo domain.FloodZoneRepository) *FloodZoneHandler {
	return &FloodZoneHandler{repo: repo}
}

type coordinateResponse struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:longitude`
}

type boundaryResponse struct {
	Coordinates []coordinateResponse `json:"coordinates"`
}

type floodZoneResponse struct {
	ID       string           `json:"id"`
	GaugeID  string           `json:"gaugeID"`
	Severity string           `json:"severity"`
	Boundary boundaryResponse `json:"boundary"`
}

func (h *FloodZoneHandler) GetZones(c *gin.Context) {
	zones, err := h.repo.FindAllActive()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to fetch flood zones",
		})
		return
	}

	var zoneResponses []floodZoneResponse
	for _, zone := range zones {
		var coords []coordinateResponse
		for _, point := range zone.Boundary.Coordinates {
			coords = append(coords, coordinateResponse{
				Latitude:  point.Lat,
				Longitude: point.Lng,
			})
		}

		zoneResponses = append(zoneResponses, floodZoneResponse{
			ID:       zone.ID.String(),
			GaugeID:  zone.GaugeID,
			Severity: string(zone.Severity),
			Boundary: boundaryResponse{Coordinates: coords},
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"zones": zoneResponses},
	})
}
