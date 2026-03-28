package handlers
import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/routing"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/google/uuid"

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

	//mock segments - Need to replace with DB

	segments := []domain.RoadSegment{
		{
			ID:         uuid.MustParse("550e8400-e29b-41d4-a716-446655440000"),
			EndNodeID:  uuid.MustParse("550e8400-e29b-41d4-a716-446655440001"),
			StartPoint: domain.GeoPoint{Lat: 6.9271, Lng: 79.8612},
			EndPoint:   domain.GeoPoint{Lat: 6.9350, Lng: 79.8500},
		},

		{
			ID:         uuid.MustParse("550e8400-e29b-41d4-a716-446655440001"),
			EndNodeID:  uuid.MustParse("550e8400-e29b-41d4-a716-446655440002"),
			StartPoint: domain.GeoPoint{Lat: 6.9350, Lng: 79.8500},
			EndPoint:   domain.GeoPoint{Lat: 6.9450, Lng: 79.8550},
		},

		{
			ID:         uuid.MustParse("550e8400-e29b-41d4-a716-446655440003"),
			EndNodeID:  uuid.MustParse("550e8400-e29b-41d4-a716-446655440004"),
			StartPoint: domain.GeoPoint{Lat: 6.9271, Lng: 79.8612},
			EndPoint:   domain.GeoPoint{Lat: 6.9400, Lng: 79.8700},
		},

		{
			ID:         uuid.MustParse("550e8400-e29b-41d4-a716-446655440004"),
			EndNodeID:  uuid.MustParse("550e8400-e29b-41d4-a716-446655440002"),
			StartPoint: domain.GeoPoint{Lat: 6.9400, Lng: 79.8700},
			EndPoint:   domain.GeoPoint{Lat: 6.9450, Lng: 79.8550},
		},
	}

	reports := []domain.HazardReport{}

	result, err := h.service.GetRoute(segments, reports, startID, goalID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"path":       result.Path,
		"total_cost": result.TotalCost,
	})

}
