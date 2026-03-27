package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/logicbuilders/flood-evacuation-backend/config"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/reports"
	"github.com/logicbuilders/flood-evacuation-backend/internal/infrastructure/repositories"
	"github.com/logicbuilders/flood-evacuation-backend/internal/interfaces/http/handlers"
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
	reportRepo := repositories.NewMockReportRepository()
	reportService := reports.NewReportService(reportRepo)
	reportHandler := handlers.NewReportHandler(reportService)

	// Create router
	router := gin.Default()

	// Health check endpoint — just to confirm server is running
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Flood Evacuation API is running",
		})
	})

	//API routes
	v1 := router.Group("/api/v1")
	{
		//public report repositories
		v1.POST("/reports", reportHandler.Submit)
		v1.GET("/reports/active", reportHandler.GetActive)

		//Admin report endpoints
		admin := v1.Group("/admin")
		{
			admin.GET("/reports/pending", reportHandler.GetPending)
			admin.PATCH("/reports/:id/approve", reportHandler.Approve)
			admin.PATCH("/reports/:id/reject", reportHandler.Reject)
		}
	}

	// Start server
	log.Printf("Server starting on port %s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
