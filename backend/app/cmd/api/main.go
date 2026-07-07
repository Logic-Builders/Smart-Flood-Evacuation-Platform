package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/logicbuilders/flood-evacuation-backend/config"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/reports"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/routing"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/external"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories"
	"github.com/logicbuilders/flood-evacuation-backend/internal/interfaces/http/handlers"
	"github.com/logicbuilders/flood-evacuation-backend/internal/interfaces/http/middleware"
	jwtutil "github.com/logicbuilders/flood-evacuation-backend/pkg/jwt"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}

	cfg := config.Load()
	jwtutil.Init(cfg.JWTSecret)

	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	reportRepo := repositories.NewMockReportRepository()
	reportService := reports.NewReportService(reportRepo)
	reportHandler := handlers.NewReportHandler(reportService)

	authHandler := handlers.NewAuthHandler(cfg)

	floodAdaptor := external.NewMockFloodAdaptor()
	routingService := routing.NewRoutingService(floodAdaptor)
	routeHandler := handlers.NewRouteHandler(routingService, reportService)

	router := gin.Default()
	router.Use(middleware.CORS(cfg.CORSOrigin))

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
		v1.GET("/network", routeHandler.GetNetwork)
		v1.POST("/route", routeHandler.PostRoute)
		v1.GET("/route", routeHandler.GetRoute)
	}

	admin := v1.Group("/admin")
	admin.Use(middleware.RequireAuth())
	{
		admin.GET("/reports/pending", reportHandler.GetPending)
		admin.PATCH("/reports/:id/approve", reportHandler.Approve)
		admin.PATCH("/reports/:id/reject", reportHandler.Reject)
	}

	log.Printf("Server starting on port %s (env=%s)", cfg.Port, cfg.AppEnv)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}

}
