// WebSocket manager that handles connections, messaging, rooms, and reconnection logic
class WebSocketManager {
    constructor(url, options = {}) {
        this.url = url;
        this.WebSocketImpl = options.WebSocket || (typeof WebSocket !== 'undefined' ? WebSocket : null);
        if (!this.WebSocketImpl) {
            throw new Error('WebSocket implementation not provided');
        }

        this.autoReconnect = options.autoReconnect !== false;
        this.reconnectInterval = options.reconnectInterval || 2000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || Infinity;
        this.serializer = options.serializer || JSON.stringify;
        this.deserializer = options.deserializer || JSON.parse;
        this.pingInterval = options.pingInterval || null;

        this.socket = null;
        this.rooms = new Map();
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.isManuallyClosed = false;
        this.pingTimer = null;
    }

    connect() {
        if (this.socket && (this.socket.readyState === this.WebSocketImpl.OPEN || this.socket.readyState === this.WebSocketImpl.CONNECTING)) {
            return Promise.resolve(this.socket);
        }

        this.isManuallyClosed = false;
        this.socket = new this.WebSocketImpl(this.url);

        return new Promise((resolve, reject) => {
            const onOpen = () => {
                this.reconnectAttempts = 0;
                this.startPing();
                this.emit('open');
                this.resubscribeRooms();
                cleanup();
                resolve(this.socket);
            };

            const onError = error => {
                this.emit('error', error);
                cleanup();
                reject(error);
            };

            const cleanup = () => {
                this.socket.removeEventListener('open', onOpen);
                this.socket.removeEventListener('error', onError);
            };

            this.socket.addEventListener('open', onOpen);
            this.socket.addEventListener('error', onError);
            this.socket.addEventListener('close', event => this.handleClose(event));
            this.socket.addEventListener('message', event => this.handleMessage(event));
        });
    }

    startPing() {
        if (!this.pingInterval) {
            return;
        }
        this.stopPing();
        this.pingTimer = setInterval(() => {
            if (this.isConnected()) {
                this.socket.send(this.serializer({ type: 'ping', timestamp: Date.now() }));
            }
        }, this.pingInterval);
    }

    stopPing() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    async reconnect() {
        if (!this.autoReconnect || this.isManuallyClosed) {
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.emit('reconnect_failed');
            return;
        }

        this.reconnectAttempts += 1;
        this.emit('reconnecting', this.reconnectAttempts);
        await new Promise(resolve => setTimeout(resolve, this.reconnectInterval));
        try {
            await this.connect();
            this.emit('reconnected', this.reconnectAttempts);
        } catch (error) {
            this.emit('reconnect_error', error);
            this.reconnect();
        }
    }

    resubscribeRooms() {
        this.rooms.forEach((roomState, room) => {
            if (roomState.autoJoin) {
                this.send({ type: 'join', room, payload: roomState.payload });
            }
        });
    }

    handleClose(event) {
        this.stopPing();
        this.emit('close', event);
        if (!this.isManuallyClosed) {
            this.reconnect();
        }
    }

    handleMessage(event) {
        let data = event.data;
        try {
            data = this.deserializer(event.data);
        } catch (error) {
            this.emit('message_error', error, event.data);
            return;
        }

        if (data && data.room) {
            const room = this.rooms.get(data.room);
            if (room) {
                room.handlers.forEach(handler => handler(data.payload, data));
            }
        }

        this.emit('message', data);
    }

    joinRoom(room, handler, options = {}) {
        if (!this.rooms.has(room)) {
            this.rooms.set(room, {
                handlers: new Set(),
                autoJoin: options.autoJoin !== false,
                payload: options.payload || null
            });
            if (options.autoJoin !== false) {
                this.send({ type: 'join', room, payload: options.payload });
            }
        }
        this.rooms.get(room).handlers.add(handler);

        return () => this.leaveRoom(room, handler);
    }

    leaveRoom(room, handler = null) {
        const roomState = this.rooms.get(room);
        if (!roomState) {
            return;
        }

        if (handler) {
            roomState.handlers.delete(handler);
        } else {
            roomState.handlers.clear();
        }

        if (roomState.handlers.size === 0) {
            this.rooms.delete(room);
            this.send({ type: 'leave', room });
        }
    }

    send(payload) {
        if (!this.isConnected()) {
            throw new Error('WebSocket is not connected');
        }
        const message = typeof payload === 'string' ? payload : this.serializer(payload);
        this.socket.send(message);
    }

    broadcast(room, payload) {
        this.send({ type: 'broadcast', room, payload });
    }

    close(code, reason) {
        this.isManuallyClosed = true;
        this.stopPing();
        if (this.socket) {
            this.socket.close(code, reason);
        }
    }

    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(listener);
        return () => this.off(event, listener);
    }

    off(event, listener) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.delete(listener);
            if (handlers.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    emit(event, ...args) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(...args);
                } catch (error) {
                    console.error(`WebSocketManager listener error for event ${event}:`, error);
                }
            });
        }
    }

    isConnected() {
        return this.socket && this.socket.readyState === this.WebSocketImpl.OPEN;
    }
}

module.exports = WebSocketManager;

