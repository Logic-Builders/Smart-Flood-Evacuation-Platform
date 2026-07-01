package dto

//Frontend sends SubmitReportRequest
type SubmitReportRequest struct {
	Latitude    float64 `json:"latitude" binding:"required"`
	Longitude   float64 `json:"longitude" binding:"required"`
	ReportType  string  `json:"report_type" binding:"required"`
	Severity    int     `json:"severity" binding:"required"`
	Description string  `json:"description"`
}

type RouteRequest struct {
	StartLat float64 `json:"start_lat" binding:"required"`
	StartLng float64 `json:"start_lng" binding:"required"`
	EndLat   float64 `json:"end_lat" binding:"required"`
	EndLng   float64 `json:"end_lng" binding:"required"`
}

//Backend sends ReportResponse back
type ReportResponse struct {
	ID          string  `json:"id"`
	ReportType  string  `json:"report_type"`
	Severity    int     `json:"severity"`
	Description string  `json:"description"`
	Status      string  `json:"status"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	ExpiresAt   string  `json:"expires_at"`
}
