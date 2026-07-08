package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/floodzones"
	"github.com/logicbuilders/flood-evacuation-backend/internal/interfaces/dto"
)

// FloodZoneHandler handles all HTTP requests related to flood risk zones.
type FloodZoneHandler struct {
	service *floodzones.FloodZoneService
}

func NewFloodZoneHandler(service *floodzones.FloodZoneService) *FloodZoneHandler {
	return &FloodZoneHandler{service: service}
}

// GetActive handles GET /api/v1/flood-zones
func (h *FloodZoneHandler) GetActive(c *gin.Context) {
	zones, err := h.service.GetActiveZones()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	response := make([]dto.FloodZoneResponse, 0, len(zones))
	for _, z := range zones {
		coords := make([]dto.CoordDTO, 0, len(z.Boundary.Coordinates))
		for _, p := range z.Boundary.Coordinates {
			coords = append(coords, dto.CoordDTO{Latitude: p.Lat, Longitude: p.Lng})
		}
		response = append(response, dto.FloodZoneResponse{
			ID:       z.ID.String(),
			GaugeID:  z.GaugeID,
			Severity: string(z.Severity),
			Boundary: dto.BoundaryDTO{Coordinates: coords},
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"zones": response},
	})
}
