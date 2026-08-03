Here is the complete project blueprint and single-source architecture spec for **Firese** (**Fi**le **Re**lay **Se**rvice).

This includes the full system design, project structure, and an exact AI system prompt you can feed to an agent (like Cursor, Claude Code, or Copilot) to generate the entire codebase cleanly using DRY principles and strict modularity.

---

# Firese — Project Blueprint

## Project Architecture & Data Flow

```
[ Sender Browser ] 
       │
       ├─ 1. Text Frame (JSON): {"type":"meta", "name":"doc.pdf", "size":104857600, ...}
       ├─ 2. Binary Frames (ArrayBuffer): [ 64KB Chunk ] [ 64KB Chunk ] ...
       │
       ▼
 [ Go Relay Server ] (In-Memory Transit Only - 0 Disk Writes, Zero Storage)
       │
       ├─ Unmarshals JSON metadata → Broadcasts to Room Clients
       ├─ Receives Raw Binary Frames → Forwards directly to WS Sockets
       │
       ▼
[ Receiver Browsers ] 
       │
       ├─ Parses Metadata → Initializes ArrayBuffer Chunk Receiver Buffer
       └─ Recombines Chunks → Triggers Local Browser File Download Blob

```

---

## 1. System Specifications & Tech Stack

* **Backend:** Go (Golang) using `gorilla/websocket` or `coder/websocket`. Zero database, zero disk persistent storage, sub-15MB RAM footprint.
* **Frontend:** Svelte 5 + Tailwind CSS + Vite.
* **Protocol:** WebSockets over TLS (`wss://`).
* **Relay Strategy:**
* **Control Traffic (JSON Text Frames):** Room joining, peer count updates, file metadata (`filename`, `filesize`, `mime`).
* **Data Traffic (Binary Frames):** Sliced 64KB `ArrayBuffer` streaming directly through Go socket buffers without unmarshalling or string encoding.



---

## 2. DRY & Modular Repository Structure

```
firese/
├── server/                    # Go Backend
│   ├── go.mod
│   ├── main.go                # Entrypoint & HTTP Server initialization
│   ├── config/                # Environment variables & constants
│   │   └── config.go
│   ├── room/                  # Room & Client Connection Management
│   │   ├── client.go          # Client connection struct & write pump
│   │   ├── hub.go             # Global hub to track active rooms
│   │   └── room.go            # Room lifecycle, mutexes, & message broadcasting
│   └── ws/                    # WebSocket Handlers
│       └── handler.go         # Dual-mode (Text vs Binary) Frame Router
│
└── web/                       # Svelte Frontend
    ├── package.json
    ├── tailwind.config.js
    ├── vite.config.js
    └── src/
        ├── App.svelte         # Root Layout & Router
        ├── lib/
        │   ├── components/    # Single-responsibility Svelte Components
        │   │   ├── RoomJoin.svelte     # OTP / Room ID Input
        │   │   ├── DropZone.svelte     # Drag-and-drop & File Picker
        │   │   ├── FileProgress.svelte # Live stream progress indicator
        │   │   └── PeerStatus.svelte   # Active room connection count
        │   ├── services/      # Modular Business Logic & API Layer
        │   │   ├── websocket.js        # WS Connection Manager (Reconnections & Binary Setup)
        │   │   └── fileStreamer.js     # File Slicing & Chunk Reassembly Engine
        │   └── stores/        # Svelte Reactivity Stores
        │       └── roomStore.js        # State for current room, peers, transfer status
        └── app.css

```

---

## 3. AI System Prompt for Code Generation

Copy and paste the prompt below into your AI code editor/agent to generate the code base step-by-step.

```markdown
# AI Prompt: Build "Firese" (File Relay Service)

You are an expert full-stack developer specializing in ultra-high-performance Go services and reactive Svelte frontends. 

Your goal is to generate the complete codebase for **Firese** (**Fi**le **Re**lay **Se**rvice)—a zero-storage, memory-efficient, web-based file streaming relay tool.

---

### STRICT DESIGN CONSTRAINTS & PATTERNS

1. **DRY & Modular Approach:** 
   - Never duplicate logic. Separate backend socket management from message routing.
   - Separate frontend UI components from WebSocket state management and binary array processing.
2. **Memory Efficiency (Go):**
   - DO NOT store file payloads in Go memory arrays or structs.
   - Process `websocket.BinaryMessage` as direct passthrough frames from the sender socket to all other receiver sockets in the room.
3. **Frontend Architecture (Svelte + Tailwind):**
   - Build UI in clean, decoupled components (`DropZone`, `FileProgress`, `PeerStatus`, `RoomJoin`).
   - Use Svelte stores for app state (`roomStore.js`).
   - Handle binary files via `ArrayBuffer` chunks (64KB size) to prevent UI thread locking.

---

### BACKEND REQUIREMENTS (`/server`)

1. **`room/` Package:**
   - Define a `Client` struct (WebSocket conn, room pointer, egress channel).
   - Define a `Room` struct with thread-safe `sync.RWMutex` managing connected `Clients`. Auto-destroy rooms when peer count reaches 0.
   - Define a `Hub` struct managing active rooms by unique OTP string IDs (e.g., `6-digit` numeric codes).

2. **`ws/handler.go`:**
   - Handle HTTP WebSocket upgrades.
   - Read loop must inspect frame type:
     - `websocket.TextMessage`: Parse JSON for room events (`join`, `file_meta`, `text_sync`). Relay to room peers.
     - `websocket.BinaryMessage`: Bypass JSON parsing completely. Forward raw bytes immediately to all other clients in the sender's room.

---

### FRONTEND REQUIREMENTS (`/web`)

1. **`lib/services/fileStreamer.js`:**
   - Function `sendFile(ws, file, onProgress)`:
     1. Sends `file_meta` JSON payload (`{ type: "file_meta", name, size, mime }`).
     2. Reads file in 64KB slices using `file.slice()`.
     3. Converts slice to `ArrayBuffer` and calls `ws.send(arrayBuffer)`.
   - Function `receiveChunk(arrayBuffer, meta)`:
     1. Appends raw buffer to an array.
     2. Tracks received bytes vs total `meta.size`.
     3. Once 100% complete, creates a local `Blob` and triggers a native browser download (`URL.createObjectURL`).

2. **UI Components (`/lib/components`):**
   - **`RoomJoin.svelte`**: Simple, minimal OTP room code entry or automatic code generator.
   - **`DropZone.svelte`**: Drag-and-drop area accepting screenshots and files up to 100MB+.
   - **`FileProgress.svelte`**: Shows real-time transfer speed, percent complete, and filename.
   - **`PeerStatus.svelte`**: Shows active clients connected to the room.

---

### GENERATION STEPS

Please construct the project files systematically:
1. First, create the Go backend (`main.go`, `config/config.go`, `room/`, `ws/`).
2. Second, create the Svelte services (`websocket.js`, `fileStreamer.js`, `roomStore.js`).
3. Third, generate the Svelte UI components and assemble them in `App.svelte`.
4. Ensure all files adhere strictly to clean code standards and single-responsibility principles.

```

---

## 4. Production Ready README.md

Below is the complete `README.md` for your GitHub repository:

```markdown
# Firese (File Relay Service)

> **Fi**le **Re**lay **Se**rvice — An ultra-lightweight, zero-storage, ad-free web tool for instant cross-device file and screenshot streaming over WebSockets.

---

## Key Features

* **Zero Cloud Storage:** Files stream directly through server memory in transit. Nothing is ever written to disk.
* **Pure Web App:** No apps to install, no CLI dependencies, no account registration.
* **OTP Room IDs:** Join or share temporary rooms using simple 6-digit codes.
* **Memory Efficient:** Native `ArrayBuffer` binary WebSocket frames bypass string/Base64 overhead. Handles 100MB+ transfers on free-tier hosting (<15MB RAM footprint).
* **Encrypted in Transit:** Fully secured over TLS/WSS protocols.

---

## Project Architecture


```

firese/
├── server/        # High-performance Go WebSocket Relay
└── web/           # Svelte + Tailwind CSS Lightweight UI

```

### Tech Stack
* **Backend:** Go (Golang), `gorilla/websocket`
* **Frontend:** Svelte 5, Tailwind CSS, Vite
* **Protocol:** Raw WebSocket Binary & Text Frames

---

## Getting Started

### Prerequisites
* Go 1.21+
* Node.js 18+

### 1. Run the Backend
```bash
cd server
go mod tidy
go run main.go

```

*Server will start on `http://localhost:8080*`

### 2. Run the Frontend

```bash
cd web
npm install
npm run dev

```

*Web app will be available on `http://localhost:5173*`

---

## How It Works

1. **Room Creation:** Sender enters or generates a 6-digit Room OTP code.
2. **Metadata Exchange:** Sender broadcasts file details (`name`, `size`, `mime`) via JSON WebSocket text frames.
3. **Binary Streaming:** The file is sliced into 64KB raw binary chunks on the client and pushed over the WebSocket connection.
4. **Zero-Copy Relay:** The Go server relays `BinaryMessage` buffers directly to receiving client sockets without parsing or caching.
5. **Reassembly:** Receivers aggregate binary chunks and trigger an instant browser blob download upon completion.

---

## License

MIT License. Free and open source for everyone.

```

```