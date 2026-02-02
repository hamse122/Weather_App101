/**
 * Advanced WebSocket Manager
 * Robust connection, rooms, heartbeat, and reconnection logic
 */

class WebSocketManager {
  static EVENTS = {
    OPEN: 'open',
    CLOSE: 'close',
    ERROR: 'error',
    MESSAGE: 'message',
    RECONNECTING: 'reconnecting',
    RECONNECTED: 'reconnected',
    RECONNECT_FAILED: 'reconnect_failed',
    MESSAGE_ERROR: 'message_error',
  };

  constructor(url, options = {}) {
    this.url = url;
    this.WebSocketImpl =
      options.WebSocket ||
      (typeof WebSocket !== 'undefined' ? WebSocket : null);

    if (!this.WebSocketImpl) {
      throw new Error('WebSocket implementation not available');
    }

    this.autoReconnect = options.autoReconnect !== false;
    this.baseReconnectInterval = options.reconnectInterval || 2000;
    this.maxReconnectInterval = options.maxReconnectInterval || 30000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? Infinity;

    this.serializer = options.serializer || JSON.stringify;
    this.deserializer = options.deserializer || JSON.parse;

    this.pingInterval = options.pingInterval || 15000;
    this.pongTimeout = options.pongTimeout || 5000;

    this.socket = null;
    this.rooms = new Map();
    this.listeners = new Map();
    this.messageQueue = [];

    this.reconnectAttempts = 0;
    this.isManuallyClosed = false;
    this.pingTimer = null;
    this.pongTimer = null;
  }

  /* -------------------- Connection -------------------- */

  connect() {
    if (this.isConnected() || this.isConnecting()) {
      return Promise.resolve(this.socket);
    }

    this.isManuallyClosed = false;
    this.socket = new this.WebSocketImpl(this.url);

    return new Promise((resolve, reject) => {
      const onOpen = () => {
        this.reconnectAttempts = 0;
        this.flushQueue();
        this.startHeartbeat();
        this.emit(WebSocketManager.EVENTS.OPEN);
        this.resubscribeRooms();
        cleanup();
        resolve(this.socket);
      };

      const onError = (err) => {
        this.emit(WebSocketManager.EVENTS.ERROR, err);
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        this.socket.removeEventListener('open', onOpen);
        this.socket.removeEventListener('error', onError);
      };

      this.socket.addEventListener('open', onOpen);
      this.socket.addEventListener('error', onError);
      this.socket.addEventListener('close', (e) => this.handleClose(e));
      this.socket.addEventListener('message', (e) => this.handleMessage(e));
    });
  }

  /* -------------------- Heartbeat -------------------- */

  startHeartbeat() {
    this.stopHeartbeat();

    this.pingTimer = setInterval(() => {
      if (!this.isConnected()) return;

      this.send({ type: 'ping', ts: Date.now() });

      this.pongTimer = setTimeout(() => {
        this.socket?.close(4000, 'Pong timeout');
      }, this.pongTimeout);
    }, this.pingInterval);
  }

  stopHeartbeat() {
    clearInterval(this.pingTimer);
    clearTimeout(this.pongTimer);
    this.pingTimer = null;
    this.pongTimer = null;
  }

  /* -------------------- Reconnect -------------------- */

  async reconnect() {
    if (
      !this.autoReconnect ||
      this.isManuallyClosed ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      this.emit(WebSocketManager.EVENTS.RECONNECT_FAILED);
      return;
    }

    const delay = Math.min(
      this.baseReconnectInterval * 2 ** this.reconnectAttempts,
      this.maxReconnectInterval
    );

    this.reconnectAttempts++;
    this.emit(WebSocketManager.EVENTS.RECONNECTING, this.reconnectAttempts);

    await new Promise((r) => setTimeout(r, delay));

    try {
      await this.connect();
      this.emit(WebSocketManager.EVENTS.RECONNECTED);
    } catch {
      this.reconnect();
    }
  }

  /* -------------------- Rooms -------------------- */

  joinRoom(room, handler, options = {}) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, {
        handlers: new Set(),
        autoJoin: options.autoJoin !== false,
        payload: options.payload ?? null,
      });

      if (options.autoJoin !== false) {
        this.send({ type: 'join', room, payload: options.payload });
      }
    }

    this.rooms.get(room).handlers.add(handler);
    return () => this.leaveRoom(room, handler);
  }

  leaveRoom(room, handler) {
    const state = this.rooms.get(room);
    if (!state) return;

    handler ? state.handlers.delete(handler) : state.handlers.clear();

    if (state.handlers.size === 0) {
      this.rooms.delete(room);
      this.send({ type: 'leave', room });
    }
  }

  resubscribeRooms() {
    for (const [room, state] of this.rooms) {
      if (state.autoJoin) {
        this.send({ type: 'join', room, payload: state.payload });
      }
    }
  }

  /* -------------------- Messaging -------------------- */

  send(payload) {
    const message =
      typeof payload === 'string' ? payload : this.serializer(payload);

    if (!this.isConnected()) {
      this.messageQueue.push(message);
      return;
    }

    this.socket.send(message);
  }

  flushQueue() {
    while (this.messageQueue.length && this.isConnected()) {
      this.socket.send(this.messageQueue.shift());
    }
  }

  broadcast(room, payload) {
    this.send({ type: 'broadcast', room, payload });
  }

  handleMessage(event) {
    let data;
    try {
      data = this.deserializer(event.data);
    } catch (err) {
      this.emit(WebSocketManager.EVENTS.MESSAGE_ERROR, err, event.data);
      return;
    }

    if (data?.type === 'pong') {
      clearTimeout(this.pongTimer);
      return;
    }

    if (data?.room && this.rooms.has(data.room)) {
      this.rooms.get(data.room).handlers.forEach((h) =>
        h(data.payload, data)
      );
    }

    this.emit(WebSocketManager.EVENTS.MESSAGE, data);
  }

  handleClose(event) {
    this.stopHeartbeat();
    this.emit(WebSocketManager.EVENTS.CLOSE, event);

    if (!this.isManuallyClosed) {
      this.reconnect();
    }
  }

  /* -------------------- Events -------------------- */

  on(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  once(event, listener) {
    const off = this.on(event, (...args) => {
      off();
      listener(...args);
    });
  }

  off(event, listener) {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event, ...args) {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(...args);
      } catch (err) {
        console.error(`[WebSocketManager:${event}]`, err);
      }
    });
  }

  /* -------------------- State -------------------- */

  isConnected() {
    return this.socket?.readyState === this.WebSocketImpl.OPEN;
  }

  isConnecting() {
    return this.socket?.readyState === this.WebSocketImpl.CONNECTING;
  }

  close(code, reason) {
    this.isManuallyClosed = true;
    this.stopHeartbeat();
    this.socket?.close(code, reason);
  }
}

module.exports = WebSocketManager;
