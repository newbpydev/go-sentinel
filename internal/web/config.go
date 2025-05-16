package web

import (
	"fmt"
	"os"
	"time"

)

// Config holds web server settings
type Config struct {
	Port         string
	TemplatePath string
	StaticPath   string
	Env          string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

// NewConfig creates a new web server configuration with defaults
func NewConfig() (*Config, error) {
	// Get port from environment or use default
	port := os.Getenv("WEB_PORT")
	if port == "" {
		port = "3000" // Default web server port
	}

	// Get template and static paths
	templatePath := os.Getenv("TEMPLATE_PATH")
	if templatePath == "" {
		templatePath = "./web/templates"
	}

	staticPath := os.Getenv("STATIC_PATH")
	if staticPath == "" {
		staticPath = "./web/static"
	}

	// Get environment (development, production, etc.)
	env := os.Getenv("APP_ENV")
	if env == "" {
		env = "development"
	}

	// Set default timeouts
	readTimeout := 10 * time.Second
	writeTimeout := 10 * time.Second

	return &Config{
		Port:         port,
		TemplatePath: templatePath,
		StaticPath:   staticPath,
		Env:          env,
		ReadTimeout:  readTimeout,
		WriteTimeout: writeTimeout,
	}, nil
}

// Addr returns the server address (host:port)
func (c *Config) Addr() string {
	return fmt.Sprintf(":%s", c.Port)
}
