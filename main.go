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

	// Health check & UptimeRobot endpoint supporting GET, POST, and OPTIONS
	healthHandler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		w.Header().Set("Content-Type", "application/json")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","server":"firese-server","message":"Server active"}`))
	}

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/ping", healthHandler)
	http.HandleFunc("/", healthHandler)

	// WebSocket handler
	http.HandleFunc("/ws", wsHandler.ServeWS)

	addr := fmt.Sprintf("0.0.0.0:%s", cfg.Port)
	log.Printf("🔥 Firese Go Server running on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("Server ListenAndServe error: %v", err)
	}
}
