package config

import "os"

type Config struct {
	Port          string
	AppEnv        string
	JWTSecret     string
	CORSOrigin    string
	AdminUsername string
	AdminPassword string
}

func Load() *Config {
	return &Config{
		Port:          getEnv("PORT", "8080"),
		AppEnv:        getEnv("APP_ENV", "development"),
		JWTSecret:     getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		CORSOrigin:    getEnv("CORS_ORIGIN", "*"),
		AdminUsername: getEnv("ADMIN_USERNAME", "admin"),
		AdminPassword: getEnv("ADMIN_PASSWORD", "admin123"),
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
