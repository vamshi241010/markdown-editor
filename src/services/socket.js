export class SocketService {
  constructor() {
    this.ws = null;
    this.subscribers = [];
    this.roomId = "";
    this.userId = "";
    this.username = "";
    this.role = "";
  }

  connect(roomId, userId, username, role) {
    this.roomId = roomId;
    this.userId = userId;
    this.username = username;
    this.role = role;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;
    
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      // Send register/join room message immediately on connection open
      this.send("study-join", { userId: this.userId, username: this.username, role: this.role });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // Broadcast message to all local subscribers
        this.subscribers.forEach((sub) => sub(msg.type, msg.payload || msg.data || msg));
      } catch (err) {
        console.error("WS message parsing failed:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }

  send(type, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket is not open. Queueing message.");
      return;
    }

    this.ws.send(
      JSON.stringify({
        type,
        roomId: this.roomId,
        userId: this.userId,
        username: this.username,
        data,
        payload: data
      })
    );
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribers = [];
  }
}

export const socketService = new SocketService();
