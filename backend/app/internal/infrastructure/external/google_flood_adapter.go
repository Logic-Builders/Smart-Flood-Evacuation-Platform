package external

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type GoogleFloodAdapter struct {
	apiKey  string
	baseURL string
}

func NewGoogleFloodAdapter(apiKey string) *GoogleFloodAdapter {
	return &GoogleFloodAdapter{
		apiKey:  apiKey,
		baseURL: "https://floodhub.googleapis.com/v1",
	}
}

type floodResponse struct {
	FloodStatus string `json:"floodStatus"`
}

func (g *GoogleFloodAdapter) GetFloodRisk(lat, lng float64) (float64, error) {
	status, err := g.GetGaugeStatus(lat, lng)
	if err != nil {
		return 0, err
	}
	return mapStatusToRisk(status), nil
}

// GetGaugeStatus returns the raw Flood Hub status string ("NORMAL", "WATCH",
// "WARNING", "EXTREME") for the gauge nearest (lat, lng). Used by
// floodhub.Poller to decide flood zone severity, not just a risk score.
//
// NOTE: this endpoint shape (GET /v1/gauges?lat&lng&key -> {floodStatus})
// hasn't been verified against a real API key/response yet — double-check
// against the actual Flood Hub API docs once a key is available.
func (g *GoogleFloodAdapter) GetGaugeStatus(lat, lng float64) (string, error) {
	url := fmt.Sprintf("%s/gauges?lat=%f&lng=%f&key=%s", g.baseURL, lat, lng, g.apiKey)

	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("flood hub request failed: status %d", resp.StatusCode)
	}

	var result floodResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.FloodStatus, nil
}

func mapStatusToRisk(status string) float64 {
	switch status {
	case "NORMAL":
		return 0.0
	case "WATCH":
		return 0.3
	case "WARNING":
		return 0.7
	case "EXTREME":
		return 1.0
	default:
		return 0.5
	}
}
