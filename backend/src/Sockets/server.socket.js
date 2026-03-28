import { Server } from 'socket.io'

let io;

export const initSocket = (httpServer) => {
    const clientOrigin = process.env.FRONTEND_URL || 'https://veltrix-bn4b.onrender.com';

    io = new Server(httpServer, {
        cors: {
            origin: clientOrigin,
            credentials: true,
        },

    });
    console.log('socket io server is running');
    io.on('connection', (socket) => {
        console.log('a user connected ' + socket.id);

        socket.on('join_chat', (chatId) => {
            if (!chatId) return;
            socket.join(`chat:${chatId}`);
        });

        socket.on('leave_chat', (chatId) => {
            if (!chatId) return;
            socket.leave(`chat:${chatId}`);
        });

        socket.on('disconnect', () => {
            console.log('user disconnected ' + socket.id);
        });

    });
}
export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
}
