package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	"github.com/newbpydev/go-sentinel/internal/web"
	"github.com/newbpydev/go-sentinel/internal/web/server"
)

func main() {
	// Load environment variables from .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: No .env file found or error loading .env file: %v", err)
	}

	// Load configuration
	cfg, err := web.NewConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// In development, use paths relative to the current working directory
	currentDir, err := os.Getwd()
	if err != nil {
		log.Fatalf("Failed to get current directory: %v", err)
	}

	// Resolve paths relative to current directory if not set in config
	if cfg.TemplatePath == "./web/templates" {
		cfg.TemplatePath = filepath.Join(currentDir, cfg.TemplatePath)
	}
	if cfg.StaticPath == "./web/static" {
		cfg.StaticPath = filepath.Join(currentDir, cfg.StaticPath)
	}

	log.Printf("Starting Go-Sentinel Web Server on port %s", cfg.Port)
	log.Printf("Templates directory: %s", cfg.TemplatePath)
	log.Printf("Static files directory: %s", cfg.StaticPath)

	// Initialize and start the web server
	srv, err := server.NewServer(cfg)
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	log.Printf("Server is running on http://localhost:%s", cfg.Port)
	if err := srv.Start(); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
