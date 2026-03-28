import dotenv from "dotenv"
dotenv.config()
import http from "http"
import { initSocket } from "./src/Sockets/server.socket.js"
import { initRedis } from "./src/config/redis.js"



import { app } from "./src/app.js"
import connectDB from "./src/config/database.js"

let httpServer = http.createServer(app)
initSocket(httpServer)

const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS) || 5000;

const connectDbWithRetry = async () => {
    const isConnected = await connectDB();

    if (!isConnected) {
        console.log(`Retrying MongoDB connection in ${DB_RETRY_DELAY_MS}ms...`);
        setTimeout(connectDbWithRetry, DB_RETRY_DELAY_MS);
    }
};

connectDbWithRetry()
initRedis()

const preferredPort = Number(process.env.PORT) || 3000;
let hasRetriedWithFallback = false;

const startServer = (port) => {
    httpServer.listen(port, () => {
        console.log(`Server is running on port ${port}`)
    });
};

httpServer.on("error", (error) => {
    if (error?.code === "EADDRINUSE" && !hasRetriedWithFallback) {
        hasRetriedWithFallback = true;
        const fallbackPort = preferredPort + 1;
        console.log(`Port ${preferredPort} is busy. Retrying on port ${fallbackPort}...`);
        startServer(fallbackPort);
        return;
    }

    throw error;
});

startServer(preferredPort);
