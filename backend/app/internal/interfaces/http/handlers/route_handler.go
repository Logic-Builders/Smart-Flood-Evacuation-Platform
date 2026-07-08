package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/reports"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/routing"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories"
	"github.com/logicbuilders/flood-evacuation-backend/internal/interfaces/dto"
)

type RouteHandler struct {
	service       *routing.RoutingService
	reportService *reports.ReportService
	roadRepo      repositories.RoadRepository
}

func NewRouteHandler(service *routing.RoutingService, reportService *reports.ReportService, roadRepo repositories.RoadRepository) *RouteHandler {
	return &RouteHandler{service: service, reportService: reportService, roadRepo: roadRepo}
}

func (h *RouteHandler) GetNetwork(c *gin.Context) {
	nodes, segments, err := h.roadRepo.GetNetworkForMap()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"nodes":    nodes,
			"segments": segments,
		},
	})
}

func (h *RouteHandler) PostRoute(c *gin.Context) {
	var req dto.RouteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_lat, start_lng, end_lat, end_lng required"})
		return
	}

	startID, endID, err := h.nearestNodePair(req.StartLat, req.StartLng, req.EndLat, req.EndLng)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.respondRoute(c, startID, endID)
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

	startID, goalID, err := h.nearestNodePair(startLat, startLng, endLat, endLng)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	h.respondRoute(c, startID, goalID)
}

func (h *RouteHandler) nearestNodePair(startLat, startLng, endLat, endLng float64) (startID, goalID string, err error) {
	start, err := h.roadRepo.NearestNodeID(startLat, startLng)
	if err != nil {
		return "", "", err
	}
	goal, err := h.roadRepo.NearestNodeID(endLat, endLng)
	if err != nil {
		return "", "", err
	}
	return start.String(), goal.String(), nil
}

func (h *RouteHandler) respondRoute(c *gin.Context, startID, goalID string) {
	reports := h.activeReports()

	result, err := h.service.GetRoute(reports, startID, goalID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	coords := make([][]float64, 0, len(result.Path))
	for _, nodeID := range result.Path {
		id, err := uuid.Parse(nodeID)
		if err != nil {
			continue
		}
		lat, lng, err := h.roadRepo.NodeCoords(id)
		if err == nil {
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
