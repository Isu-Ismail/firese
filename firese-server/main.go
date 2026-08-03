package main

import (
	"fmt"
	"log"
	"net/http"

	"firese-server/config"
	"firese-server/room"
	"firese-server/ws"
)

func main() {
	cfg := config.LoadConfig()
	hub := room.NewHub()
	wsHandler := ws.NewHandler(hub, cfg)

	// Health check endpoint for Render monitoring
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// WebSocket handler
	http.HandleFunc("/ws", wsHandler.ServeWS)

	addr := fmt.Sprintf("0.0.0.0:%s", cfg.Port)
	log.Printf("🔥 Firese Go Server running on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("Server ListenAndServe error: %v", err)
	}
}
