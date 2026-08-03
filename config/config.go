package config

import (
	"os"
)

type Config struct {
	Port           string
	AllowedOrigins string
}

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "*"
	}

	return &Config{
		Port:           port,
		AllowedOrigins: allowedOrigins,
	}
}
