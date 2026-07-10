package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/floodzones"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
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

// Deactivate handles PATCH /api/v1/admin/flood-zones/:id/deactivate
func (h *FloodZoneHandler) Deactivate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid zone ID"})
		return
	}

	reopened, err := h.service.DeactivateZone(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"message": "Flood zone deactivated", "roads_reopened": reopened},
	})
}

type createZoneRequest struct {
	ZoneName  string  `json:"zone_name"`
	Severity  string  `json:"severity" binding:"required"`
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
	RadiusKM  float64 `json:"radius_km" binding:"required"`
}

// Create handles POST /api/v1/admin/flood-zones — a manually-entered flood
// warning (dashboard admin picks a center point + radius on the map).
func (h *FloodZoneHandler) Create(c *gin.Context) {
	var req createZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	zone, blocked, err := h.service.CreateZone(req.ZoneName, domain.FloodSeverity(req.Severity), req.Latitude, req.Longitude, req.RadiusKM)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	coords := make([]dto.CoordDTO, 0, len(zone.Boundary.Coordinates))
	for _, p := range zone.Boundary.Coordinates {
		coords = append(coords, dto.CoordDTO{Latitude: p.Lat, Longitude: p.Lng})
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"zone": dto.FloodZoneResponse{
				ID:       zone.ID.String(),
				GaugeID:  zone.GaugeID,
				Severity: string(zone.Severity),
				Boundary: dto.BoundaryDTO{Coordinates: coords},
			},
			"roads_blocked": blocked,
		},
	})
}
