import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'https://veltrix-bn4b.onrender.com';
let socketInstance = null;

export const initializeSocketConnection = () => {
    if (socketInstance?.connected) {
        return socketInstance;
    }

    if (!socketInstance) {
        socketInstance = io(SOCKET_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
        });

        socketInstance.on('connect', () => {
            console.log('connected to socket server');
        });

        socketInstance.on('disconnect', () => {
            console.log('disconnected from socket server');
        });
    }

    return socketInstance;
}

export const disconnectSocketConnection = () => {
    if (!socketInstance) return;
    socketInstance.disconnect();
    socketInstance = null;
}

export const joinChatRoom = (chatId) => {
    if (!chatId) return;
    const socket = initializeSocketConnection();
    socket.emit('join_chat', chatId);
}

export const leaveChatRoom = (chatId) => {
    if (!chatId || !socketInstance) return;
    socketInstance.emit('leave_chat', chatId);
}

export const onChatMessage = (handler) => {
    const socket = initializeSocketConnection();
    socket.on('chat_message', handler);
    return () => socket.off('chat_message', handler);
}