package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/logicbuilders/flood-evacuation-backend/config"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/dams"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/floodhub"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/floodzones"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/reports"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/routing"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/weather"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/external"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories/postgres"
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

	pool, err := postgres.NewPool(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to db: %v", err)
	}
	defer pool.Close()

	reportRepo := postgres.NewPostgresReportRepository(pool)
	reportService := reports.NewReportService(reportRepo)
	reportHandler := handlers.NewReportHandler(reportService)

	authHandler := handlers.NewAuthHandler(cfg)

	roadRepo := postgres.NewPostgresRoadRepository(pool)
	floodAdaptor := external.NewMockFloodAdaptor()
	routingService := routing.NewRoutingService(floodAdaptor, roadRepo)
	routeHandler := handlers.NewRouteHandler(routingService, reportService, roadRepo)

	floodZoneRepo := postgres.NewPostgresFloodZoneRepository(pool)
	floodZoneService := floodzones.NewFloodZoneService(floodZoneRepo, roadRepo)
	floodZoneHandler := handlers.NewFloodZoneHandler(floodZoneService)

	weatherRepo := postgres.NewPostgresWeatherRepository(pool)
	weatherService := weather.NewWeatherService(weatherRepo)
	weatherHandler := handlers.NewWeatherHandler(weatherService)

	damRepo := postgres.NewPostgresDamRepository(pool)
	damService := dams.NewDamService(damRepo, roadRepo)
	damHandler := handlers.NewDamHandler(damService)

	// Google Flood Hub auto-prediction: stays off (current manual-only
	// behavior, zero risk) until GOOGLE_FLOOD_HUB_API_KEY is set in .env.
	if cfg.FloodHubAPIKey == "" {
		log.Println("[floodhub] no API key set — flood zones remain manual-only (set GOOGLE_FLOOD_HUB_API_KEY in .env to enable)")
	} else {
		floodHubAdapter := external.NewGoogleFloodAdapter(cfg.FloodHubAPIKey)
		poller := floodhub.NewPoller(floodHubAdapter, floodZoneService)
		go poller.Run()
	}

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
		v1.GET("/flood-zones", floodZoneHandler.GetActive)
		v1.GET("/weather", weatherHandler.GetRecent)
		v1.GET("/dams", damHandler.GetAll)
	}

	admin := v1.Group("/admin")
	admin.Use(middleware.RequireAuth())
	{
		admin.GET("/reports/pending", reportHandler.GetPending)
		admin.PATCH("/reports/:id/approve", reportHandler.Approve)
		admin.PATCH("/reports/:id/reject", reportHandler.Reject)
		admin.PATCH("/flood-zones/:id/deactivate", floodZoneHandler.Deactivate)
		admin.POST("/flood-zones", floodZoneHandler.Create)
		admin.POST("/weather", weatherHandler.Record)
		admin.POST("/dams", damHandler.Create)
		admin.PATCH("/dams/:id", damHandler.Update)
		admin.POST("/dams/:id/alert", damHandler.SetAlert)
		admin.DELETE("/dams/:id/alert", damHandler.ClearAlert)
	}

	log.Printf("Server starting on port %s (env=%s)", cfg.Port, cfg.AppEnv)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
