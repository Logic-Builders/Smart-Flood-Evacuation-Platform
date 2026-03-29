package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/routing"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
)

type RouteHandler struct {
	service  *routing.RoutingService
	roadRepo domain.RoadRepository
}

func NewRouteHandler(service *routing.RoutingService, roadRepo domain.RoadRepository) *RouteHandler {
	return &RouteHandler{service: service, roadRepo: roadRepo}
}

func (h *RouteHandler) GetRoute(c *gin.Context) {
	startID := c.Query("start")
	goalID := c.Query("goal")

	if startID == "" || goalID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"erros": "start and goal query params required"})
		return
	}

	segments, err := h.roadRepo.FindAllPassable()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load segments"})
		return
	}

	domainSegments := make([]domain.RoadSegment, len(segments))
	for i, s := range segments {
		domainSegments[i] = *s
	}

	reports := []domain.HazardReport{}

	result, err := h.service.GetRoute(domainSegments, reports, startID, goalID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"path":       result.Path,
		"total_cost": result.TotalCost,
	})

}
