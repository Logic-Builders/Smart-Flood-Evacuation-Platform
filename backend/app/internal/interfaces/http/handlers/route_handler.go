package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/routing"
)

type RouteHandler struct {
	service *routing.RoutingService
}

func NewRouteHandler(service *routing.RoutingService) *RouteHandler {
	return &RouteHandler{service: service}
}

func (h *RouteHandler) GetRoute(c *gin.Context) {
	startID := c.Query("start")
	goalID := c.Query("goal")

	if startID == "" || goalID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"erros": "start and goal query params required"})
		return
	}

	result, err := h.service.GetRoute(startID, goalID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"path":       result.Path,
		"total_cost": result.TotalCost,
	})

	c.Query("start")
}
