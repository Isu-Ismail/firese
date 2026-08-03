package room

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type BroadcastPacket struct {
	SenderID    string
	MessageType int
	Payload     []byte
}

type PeerCountMessage struct {
	Type  string `json:"type"`
	Count int    `json:"count"`
}

type Room struct {
	ID         string
	Hub        *Hub
	clients    map[string]*Client
	mu         sync.RWMutex
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan BroadcastPacket
}

func NewRoom(id string, hub *Hub) *Room {
	return &Room{
		ID:         id,
		Hub:        hub,
		clients:    make(map[string]*Client),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan BroadcastPacket, 1024),
	}
}

func (r *Room) Run() {
	for {
		select {
		case client := <-r.Register:
			r.mu.Lock()
			r.clients[client.ID] = client
			r.mu.Unlock()
			log.Printf("[Room %s] Client joined: %s (Total: %d)", r.ID, client.ID, len(r.clients))
			r.broadcastPeerCount()

		case client := <-r.Unregister:
			r.mu.Lock()
			if _, ok := r.clients[client.ID]; ok {
				delete(r.clients, client.ID)
				close(client.Egress)
				log.Printf("[Room %s] Client left: %s (Remaining: %d)", r.ID, client.ID, len(r.clients))
			}
			clientCount := len(r.clients)
			r.mu.Unlock()

			if clientCount == 0 {
				log.Printf("[Room %s] Empty room destroying...", r.ID)
				r.Hub.DestroyRoom(r.ID)
				return
			} else {
				r.broadcastPeerCount()
			}

		case packet := <-r.Broadcast:
			r.mu.RLock()
			for _, client := range r.clients {
				// Bypass sender so sender does not receive its own packets
				if client.ID == packet.SenderID {
					continue
				}

				select {
				case client.Egress <- EgressMessage{MessageType: packet.MessageType, Payload: packet.Payload}:
				default:
					log.Printf("[Room %s] Client %s egress full, dropping frame", r.ID, client.ID)
				}
			}
			r.mu.RUnlock()
		}
	}
}

func (r *Room) broadcastPeerCount() {
	r.mu.RLock()
	count := len(r.clients)
	payload, _ := json.Marshal(PeerCountMessage{
		Type:  "peer_count",
		Count: count,
	})

	for _, client := range r.clients {
		select {
		case client.Egress <- EgressMessage{MessageType: websocket.TextMessage, Payload: payload}:
		default:
		}
	}
	r.mu.RUnlock()
}
