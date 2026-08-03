package room

import (
	"sync"
)

type Hub struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		rooms: make(map[string]*Room),
	}
}

func (h *Hub) GetOrCreateRoom(roomID string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	r, exists := h.rooms[roomID]
	if !exists {
		r = NewRoom(roomID, h)
		h.rooms[roomID] = r
		go r.Run()
	}
	return r
}

func (h *Hub) DestroyRoom(roomID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.rooms, roomID)
}
