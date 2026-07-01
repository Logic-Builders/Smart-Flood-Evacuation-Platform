package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/reports"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/routing"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/data"
	"github.com/logicbuilders/flood-evacuation-backend/internal/interfaces/dto"
)

type RouteHandler struct {
	service       *routing.RoutingService
	reportService *reports.ReportService
}

func NewRouteHandler(service *routing.RoutingService, reportService *reports.ReportService) *RouteHandler {
	return &RouteHandler{service: service, reportService: reportService}
}

func (h *RouteHandler) GetNetwork(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"nodes":    data.GetDemoNodes(),
			"segments": data.SegmentsForMap(),
		},
	})
}

func (h *RouteHandler) PostRoute(c *gin.Context) {
	var req dto.RouteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_lat, start_lng, end_lat, end_lng required"})
		return
	}

	startID := data.NearestNode(req.StartLat, req.StartLng)
	goalID := data.NearestNode(req.EndLat, req.EndLng)

	h.respondRoute(c, startID, goalID)
}

func (h *RouteHandler) GetRoute(c *gin.Context) {
	startLat := parseFloat(c.Query("start_lat"))
	startLng := parseFloat(c.Query("start_lng"))
	endLat := parseFloat(c.Query("end_lat"))
	endLng := parseFloat(c.Query("end_lng"))

	if startLat == 0 && startLng == 0 && endLat == 0 && endLng == 0 {
		startID := c.Query("start")
		goalID := c.Query("goal")
		if startID == "" || goalID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "provide start_lat/start_lng/end_lat/end_lng or start/goal node ids"})
			return
		}
		h.respondRoute(c, startID, goalID)
		return
	}

	startID := data.NearestNode(startLat, startLng)
	goalID := data.NearestNode(endLat, endLng)
	h.respondRoute(c, startID, goalID)
}

func (h *RouteHandler) respondRoute(c *gin.Context, startID, goalID string) {
	segments := data.GetDemoSegments()
	reports := h.activeReports()

	result, err := h.service.GetRoute(segments, reports, startID, goalID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	coords := make([][]float64, 0, len(result.Path))
	for _, nodeID := range result.Path {
		lat, lng, ok := data.NodeCoords(nodeID)
		if ok {
			coords = append(coords, []float64{lat, lng})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"path":        result.Path,
			"coordinates": coords,
			"total_cost":  result.TotalCost,
			"start_node":  startID,
			"goal_node":   goalID,
		},
	})
}

func (h *RouteHandler) activeReports() []domain.HazardReport {
	active, err := h.reportService.GetActiveReports()
	if err != nil {
		return nil
	}
	out := make([]domain.HazardReport, 0, len(active))
	for _, r := range active {
		out = append(out, *r)
	}
	return out
}

func parseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}
