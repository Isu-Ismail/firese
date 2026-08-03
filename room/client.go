package room

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 120 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 21 * 1024 * 1024 // 21MB max frame limit (supports 20MB files + encryption overhead)
)

type EgressMessage struct {
	MessageType int
	Payload     []byte
}

type Client struct {
	ID     string
	Room   *Room
	Conn   *websocket.Conn
	Egress chan EgressMessage
}

func NewClient(id string, room *Room, conn *websocket.Conn) *Client {
	return &Client{
		ID:     id,
		Room:   room,
		Conn:   conn,
		Egress: make(chan EgressMessage, 2048),
	}
}

func (c *Client) ReadPump(hub *Hub) {
	defer func() {
		c.Room.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		messageType, payload, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[Client %s] Read error: %v", c.ID, err)
			}
			break
		}

		// Parse JSON control signals
		if messageType == websocket.TextMessage {
			var packet struct {
				Type         string `json:"type"`
				Protocol     string `json:"protocol"`
				TargetPeerID string `json:"targetPeerId"`
			}
			if err := json.Unmarshal(payload, &packet); err == nil {
				if packet.Type == "set_room_protocol" && packet.Protocol != "" {
					if c.Room.SetProtocol(c.ID, packet.Protocol) {
						c.Room.broadcastRoomInfo()
					}
					continue
				} else if packet.Type == "kick_peer" && packet.TargetPeerID != "" {
					c.Room.KickPeer(c.ID, packet.TargetPeerID)
					continue
				}
			}
		}

		// Relay frame to room broadcast channel
		c.Room.Broadcast <- BroadcastPacket{
			SenderID:    c.ID,
			MessageType: messageType,
			Payload:     payload,
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.Egress:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteMessage(msg.MessageType, msg.Payload); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
