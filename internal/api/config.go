package api

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
)

// Config holds API settings for the server, middleware, etc.
type Config struct {
	Port         string
	ReadTimeout  int
	WriteTimeout int
	Env          string
}

// loadEnv loads environment variables from .env file if it exists
func loadEnv() error {
	envPath := ".env"
	if _, err := os.Stat(envPath); err == nil {
		if err := godotenv.Load(envPath); err != nil {
			return fmt.Errorf("error loading .env file: %w", err)
		}
	}
	return nil
}

// NewConfig returns a Config struct initialized from environment variables or defaults.
func NewConfig() Config {
	// Load environment variables from .env file if it exists
	if err := loadEnv(); err != nil {
		log.Printf("Warning: %v", err)
	}

	// Get port from environment or use default
	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080"
	}

	// Get environment (development, production, etc.)
	env := os.Getenv("API_ENV")
	if env == "" {
		env = "development"
	}

	// Set default timeouts if not specified
	readTimeout := 10 * time.Second
	writeTimeout := 10 * time.Second

	return Config{
		Port:         port,
		ReadTimeout:  int(readTimeout.Seconds()),
		WriteTimeout: int(writeTimeout.Seconds()),
		Env:          env,
	}
}
