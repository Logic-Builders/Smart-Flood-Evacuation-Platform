package config

import "os"

type Config struct {
	Port          string
	AppEnv        string
	JWTSecret     string
	CORSOrigin    string
	AdminUsername string
	AdminPassword string
	DatabaseURL   string
	// FloodHubAPIKey enables the Google Flood Hub auto-prediction poller when
	// set. Leave empty to keep flood zones manual-only (default/current
	// behavior) — see internal/application/floodhub/poller.go.
	FloodHubAPIKey string
}

func Load() *Config {
	return &Config{
		Port:           getEnv("PORT", "8080"),
		AppEnv:         getEnv("APP_ENV", "development"),
		JWTSecret:      getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		CORSOrigin:     getEnv("CORS_ORIGIN", "*"),
		AdminUsername:  getEnv("ADMIN_USERNAME", "admin"),
		AdminPassword:  getEnv("ADMIN_PASSWORD", "admin123"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://postgres:password@localhost:5432/flood_evacuation?sslmode=disable"),
		FloodHubAPIKey: getEnv("GOOGLE_FLOOD_HUB_API_KEY", ""),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func (c *Config) IsProduction() bool {
	return c.AppEnv == "production"
}
