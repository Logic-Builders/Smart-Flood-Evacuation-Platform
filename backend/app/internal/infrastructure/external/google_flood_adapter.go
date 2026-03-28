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
	url := fmt.Sprintf("%s/gauges?lat=%f&lng=%f&key=%s", g.baseURL, lat, lng, g.apiKey)

	resp, err := http.Get(url)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result floodResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}

	return mapStatusToRisk(result.FloodStatus), nil
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
