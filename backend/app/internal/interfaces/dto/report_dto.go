package dto

type LocationResponse struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

//Frontend sends SubmitReportRequest
type SubmitReportRequest struct {
	Latitude    float64 `json:"latitude" binding:"required"`
	Longitude   float64 `json:"longitude" binding:"required"`
	ReportType  string  `json:"report_type" binding:required"`
	Severity    int     `json:"severity" binding:"required"`
	Description string  `json:"description"`
}

//Backend sends ReportResponse back
type ReportResponse struct {
	ID          string `json: "id"`
	ReportType  string `json:"report_type"`
	Severity    int    `json:"severity"`
	Description string `json:"description"`
	Status      string `json:"status"`
	//Latitude    float64 `json: "latitude"`
	//Longitude   float64 `json:"longitude"`
	Location  LocationResponse `json:"location"`
	ExpiresAt string           `json:"expires_at"`
}
