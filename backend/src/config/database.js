import mongoose from "mongoose";

mongoose.set("bufferCommands", false);

export const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return true;
    }

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 5000,
            socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 15000,
            maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 10
        });

        console.log("connect to DB");
        return true;
    }
    catch (error) {
        console.error("Mongo connection error:", error.message);
        return false;
    }
}

export default connectDB;
