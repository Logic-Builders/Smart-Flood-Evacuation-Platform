package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/logicbuilders/flood-evacuation-backend/internal/application/reports"
	"github.com/logicbuilders/flood-evacuation-backend/internal/domain"
	"github.com/logicbuilders/flood-evacuation-backend/internal/interfaces/dto"
)

// ReportHandler handles all HTTP requests related to hazard reports
type ReportHandler struct {
	service *reports.ReportService
}

// NewReportHandler creates new ReportHandler
func NewReportHandler(service *reports.ReportService) *ReportHandler {
	return &ReportHandler{service: service}
}

// Submit handles POST/api/v1/reports
func (h *ReportHandler) Submit(c *gin.Context) {
	var input dto.SubmitReportRequest

	//Parse JSON body- if binding fails, Gin auto returns 400
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// The mobile app has no authenticated user accounts yet, so public submissions
	// are attributed to a fixed, seeded "anonymous public reporter" row (see
	// domain.AnonymousReporterID and database.sql) rather than a real JWT user ID.
	reporterID := domain.AnonymousReporterID

	//Call the service
	report, err := h.service.SubmitReport(
		reporterID,
		input.Latitude,
		input.Longitude,
		domain.ReportType(input.ReportType),
		input.Severity,
		input.Description,
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	//Return success response
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": dto.ReportResponse{
			ID:          report.ID.String(),
			ReportType:  string(report.ReportType),
			Severity:    report.Severity,
			Description: report.Description,
			Status:      string(report.ValidationStatus),
			Location:    dto.LocationDTO{Latitude: report.Location.Lat, Longitude: report.Location.Lng},
			SubmittedAt: report.CreatedAt.Format("2006-01-02T15:04:05Z"),
			ExpiresAt:   report.ExpiresAt.Format("2006-01-02T15:04:05Z"),
		},
	})
}

//GetActive handles GET/api/v1/reports/active

func (h *ReportHandler) GetActive(c *gin.Context) {
	activeReports, err := h.service.GetActiveReports()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	//Convert domain objects to DTOs

	response := []dto.ReportResponse{} // not nil, so an empty result marshals to [] not null
	for _, r := range activeReports {
		response = append(response, dto.ReportResponse{
			ID:          r.ID.String(),
			ReportType:  string(r.ReportType),
			Severity:    r.Severity,
			Description: r.Description,
			Status:      string(r.ValidationStatus),
			Location:    dto.LocationDTO{Latitude: r.Location.Lat, Longitude: r.Location.Lng},
			SubmittedAt: r.CreatedAt.Format("2006-01-02T15:04:05Z"),
			ExpiresAt:   r.ExpiresAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"reports": response},
	})
}

// GetPending handles GET/api/v1/admin/reports/pending
func (h *ReportHandler) GetPending(c *gin.Context) {
	pendingReports, err := h.service.GetPendingReports()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	response := []dto.ReportResponse{} // not nil, so an empty result marshals to [] not null
	for _, r := range pendingReports {
		response = append(response, dto.ReportResponse{
			ID:          r.ID.String(),
			ReportType:  string(r.ReportType),
			Severity:    r.Severity,
			Description: r.Description,
			Status:      string(r.ValidationStatus),
			Location:    dto.LocationDTO{Latitude: r.Location.Lat, Longitude: r.Location.Lng},
			SubmittedAt: r.CreatedAt.Format("2006-01-02T15:04:05Z"),
			ExpiresAt:   r.ExpiresAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"reports": response},
	})

}

// Approve handles PATCH/api/v1/admin/reports/:id/approve
func (h *ReportHandler) Approve(c *gin.Context) {
	idStr := c.Param("id")
	reportID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "invalid report ID",
		})
		return
	}

	if err := h.service.ApproveReport(reportID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"message": "Report approved successfully"},
	})
}

// Reject handles PATCH/api/v1/admin/reports/:id/reject
func (h *ReportHandler) Reject(c *gin.Context) {
	idStr := c.Param("id")
	reportID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "invalid report ID",
		})
		return
	}

	if err := h.service.RejectReport(reportID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"message": "Report rejected successfully"},
	})
}
