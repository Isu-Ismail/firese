package ws

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"

	"firese-server/config"
	"firese-server/room"

	"github.com/gorilla/websocket"
)

func generateClientID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

type Handler struct {
	Hub      *room.Hub
	Upgrader websocket.Upgrader
}

func NewHandler(hub *room.Hub, cfg *config.Config) *Handler {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  512 * 1024,
		WriteBufferSize: 512 * 1024,
		CheckOrigin: func(r *http.Request) bool {
			// Allow all origins for Render <-> GitHub Pages cross-origin communication
			return true
		},
	}

	return &Handler{
		Hub:      hub,
		Upgrader: upgrader,
	}
}

func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("room")
	if roomID == "" {
		http.Error(w, "Room ID required", http.StatusBadRequest)
		return
	}

	conn, err := h.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	clientID := generateClientID()
	targetRoom := h.Hub.GetOrCreateRoom(roomID)

	client := room.NewClient(clientID, targetRoom, conn)
	targetRoom.Register <- client

	go client.WritePump()
	go client.ReadPump(h.Hub)
}
