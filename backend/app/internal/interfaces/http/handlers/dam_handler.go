package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/dams"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

type DamHandler struct {
	service *dams.DamService
}

func NewDamHandler(service *dams.DamService) *DamHandler {
	return &DamHandler{service: service}
}

func damToJSON(d *domain.DamStation) gin.H {
	alertSetAt := interface{}(nil)
	if d.AlertSetAt != nil {
		alertSetAt = *d.AlertSetAt
	}
	return gin.H{
		"id":                  d.ID.String(),
		"name":                d.Name,
		"river_name":          d.RiverName,
		"location":            gin.H{"latitude": d.Location.Lat, "longitude": d.Location.Lng},
		"current_water_level": d.CurrentWaterLevel,
		"max_capacity_m3":     d.MaxCapacityM3,
		"alert_level_m":       d.AlertLevelM,
		"minor_flood_level_m": d.MinorFloodLevelM,
		"major_flood_level_m": d.MajorFloodLevelM,
		"gate_status":         string(d.GateStatus),
		"discharge_rate_m3s":  d.DischargeRateM3S,
		"risk_ratio":          d.RiskRatio(),
		"downstream_alert":    d.DownstreamAlert,
		"alert_radius_km":     d.AlertRadiusKM,
		"alert_set_at":        alertSetAt,
		"last_updated":        d.LastUpdated,
	}
}

// GetAll handles GET /api/v1/dams
func (h *DamHandler) GetAll(c *gin.Context) {
	dams, err := h.service.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	response := make([]gin.H, 0, len(dams))
	for _, d := range dams {
		response = append(response, damToJSON(d))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"dams": response}})
}

type damRequest struct {
	Name              string  `json:"name" binding:"required"`
	RiverName         string  `json:"river_name"`
	Latitude          float64 `json:"latitude" binding:"required"`
	Longitude         float64 `json:"longitude" binding:"required"`
	CurrentWaterLevel float64 `json:"current_water_level"`
	MaxCapacityM3     float64 `json:"max_capacity_m3"`
	AlertLevelM       float64 `json:"alert_level_m" binding:"required"`
	MinorFloodLevelM  float64 `json:"minor_flood_level_m" binding:"required"`
	MajorFloodLevelM  float64 `json:"major_flood_level_m" binding:"required"`
	GateStatus        string  `json:"gate_status" binding:"required"`
	DischargeRateM3S  float64 `json:"discharge_rate_m3s"`
}

func (r damRequest) toInput() dams.DamInput {
	return dams.DamInput{
		Name: r.Name, RiverName: r.RiverName,
		Lat: r.Latitude, Lng: r.Longitude,
		CurrentWaterLevel: r.CurrentWaterLevel, MaxCapacityM3: r.MaxCapacityM3,
		AlertLevelM: r.AlertLevelM, MinorFloodLevelM: r.MinorFloodLevelM, MajorFloodLevelM: r.MajorFloodLevelM,
		GateStatus: domain.GateStatus(r.GateStatus), DischargeRateM3S: r.DischargeRateM3S,
	}
}

// Create handles POST /api/v1/admin/dams ("Add Dam")
func (h *DamHandler) Create(c *gin.Context) {
	var req damRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	dam, err := h.service.CreateDam(req.toInput())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": damToJSON(dam)})
}

// Update handles PATCH /api/v1/admin/dams/:id ("Edit Dam")
func (h *DamHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid dam ID"})
		return
	}
	var req damRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	if err := h.service.UpdateDam(id, req.toInput()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"message": "Dam station updated"}})
}

type setAlertRequest struct {
	RadiusKM float64 `json:"radius_km"`
}

// SetAlert handles POST /api/v1/admin/dams/:id/alert ("Mark Downstream Risk")
func (h *DamHandler) SetAlert(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid dam ID"})
		return
	}
	var req setAlertRequest
	_ = c.ShouldBindJSON(&req) // radius_km optional, defaults to 10km in the service

	blocked, err := h.service.SetDownstreamAlert(id, req.RadiusKM)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"message": "Downstream risk alert set", "roads_blocked": blocked},
	})
}

// ClearAlert handles DELETE /api/v1/admin/dams/:id/alert
func (h *DamHandler) ClearAlert(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "invalid dam ID"})
		return
	}
	reopened, err := h.service.ClearDownstreamAlert(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"message": "Downstream risk alert cleared", "roads_reopened": reopened},
	})
}
