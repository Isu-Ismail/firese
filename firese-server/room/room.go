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

type RoomInfoMessage struct {
	Type       string `json:"type"`
	HostPeerID string `json:"hostPeerId"`
	Protocol   string `json:"protocol"`
}

type KickNoticeMessage struct {
	Type   string `json:"type"`
	Target string `json:"targetPeerId"`
}

type Room struct {
	ID         string
	HostPeerID string
	Protocol   string
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
		HostPeerID: "",
		Protocol:   "webrtc", // Default to WebRTC P2P
		Hub:        hub,
		clients:    make(map[string]*Client),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan BroadcastPacket, 1024),
	}
}

func (r *Room) KickPeer(hostID string, targetID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Verify request is from room host
	if r.HostPeerID != "" && r.HostPeerID != hostID {
		log.Printf("[Room %s] Kick failed: sender %s is not host (%s)", r.ID, hostID, r.HostPeerID)
		return false
	}

	client, exists := r.clients[targetID]
	if !exists {
		return false
	}

	log.Printf("[Room %s] Host %s kicking peer %s", r.ID, hostID, targetID)

	// Send kicked notice directly to target client
	kickedPayload, _ := json.Marshal(KickNoticeMessage{
		Type:   "peer_kicked",
		Target: targetID,
	})
	select {
	case client.Egress <- EgressMessage{MessageType: websocket.TextMessage, Payload: kickedPayload}:
	default:
	}

	// Close client connection & remove from map
	delete(r.clients, targetID)
	close(client.Egress)
	client.Conn.Close()

	return true
}

func (r *Room) SetProtocol(hostID string, protocol string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.HostPeerID != "" && r.HostPeerID != hostID {
		return false
	}

	if protocol == "webrtc" || protocol == "relay" {
		r.Protocol = protocol
		log.Printf("[Room %s] Host %s updated protocol to %s", r.ID, hostID, protocol)
		return true
	}
	return false
}

func (r *Room) Run() {
	for {
		select {
		case client := <-r.Register:
			r.mu.Lock()
			r.clients[client.ID] = client
			// First client to create/join empty room becomes the Room Host
			if r.HostPeerID == "" {
				r.HostPeerID = client.ID
				log.Printf("[Room %s] Designated host: %s", r.ID, client.ID)
			}
			r.mu.Unlock()

			log.Printf("[Room %s] Client joined: %s (Total: %d)", r.ID, client.ID, len(r.clients))
			r.broadcastRoomInfo()
			r.broadcastPeerCount()

		case client := <-r.Unregister:
			r.mu.Lock()
			if _, ok := r.clients[client.ID]; ok {
				delete(r.clients, client.ID)
				close(client.Egress)
				log.Printf("[Room %s] Client left: %s (Remaining: %d)", r.ID, client.ID, len(r.clients))
			}
			// If host leaves, assign next available peer as host
			if client.ID == r.HostPeerID {
				r.HostPeerID = ""
				for _, remaining := range r.clients {
					r.HostPeerID = remaining.ID
					log.Printf("[Room %s] Host reassigned to: %s", r.ID, r.HostPeerID)
					break
				}
			}
			clientCount := len(r.clients)
			r.mu.Unlock()

			if clientCount == 0 {
				log.Printf("[Room %s] Empty room destroying...", r.ID)
				r.Hub.DestroyRoom(r.ID)
				return
			} else {
				r.broadcastRoomInfo()
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

func (r *Room) broadcastRoomInfo() {
	r.mu.RLock()
	payload, _ := json.Marshal(RoomInfoMessage{
		Type:       "room_info",
		HostPeerID: r.HostPeerID,
		Protocol:   r.Protocol,
	})

	for _, client := range r.clients {
		select {
		case client.Egress <- EgressMessage{MessageType: websocket.TextMessage, Payload: payload}:
		default:
		}
	}
	r.mu.RUnlock()
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
