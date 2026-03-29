package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/logicbuilders/flood-evacuation-backend/config"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/reports"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/routing"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/database"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/external"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories"
	"github.com/logicbuilders/flood-evacuation-backend/internal/interfaces/http/handlers"
	"github.com/logicbuilders/flood-evacuation-backend/internal/interfaces/http/middleware"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}

	// Load config
	cfg := config.Load()

	//Wire up dependencies
	//MockRepository -> ReportService -> Report Handler
	pool := database.NewPool(cfg.DBURL)
	reportRepo := repositories.NewPostgresReportRepository(pool)
	reportService := reports.NewReportService(reportRepo)
	reportHandler := handlers.NewReportHandler(reportService)

	authHandler := handlers.NewAuthHandler()

	floodAdaptor := external.NewMockFloodAdaptor()
	routingService := routing.NewRoutingService(floodAdaptor)
	routeHandler := handlers.NewRouteHandler(routingService)

	floodZoneRepo := repositories.NewMockFloodZoneRepository()
	floodZoneHandler := handlers.NewFloodZoneHandler(floodZoneRepo)

	//router
	router := gin.Default()

	//public routes
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Flood Evacuation API is running",
		})
	})
	router.POST("/auth/login", authHandler.Login)

	v1 := router.Group("/api/v1")
	{
		v1.POST("/reports", reportHandler.Submit)
		v1.GET("/reports/active", reportHandler.GetActive)
		v1.GET("/route", routeHandler.GetRoute)
		v1.GET("/flood-zones", floodZoneHandler.GetZones)
	}

	// admin routes - protected
	admin := v1.Group("/admin")
	admin.Use(middleware.RequireAuth())
	{
		admin.GET("/reports/pending", reportHandler.GetPending)
		admin.PATCH("/reports/:id/approve", reportHandler.Approve)
		admin.PATCH("/reports/:id/reject", reportHandler.Reject)
	}

	log.Printf("Server starting on port %s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
