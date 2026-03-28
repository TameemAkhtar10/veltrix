import express from 'express';
import authRouter from './routes/auth.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRouter from './routes/chat.routes.js';
import uploadRouter from './routes/upload.routes.js';
import cookiepareser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '..', 'public');
const clientBuildPath = path.join(publicPath, 'dist');



export let app = express();

app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://veltrix-bn4b.onrender.com',
    credentials: true,
}))
app.use(cookiepareser());
app.use(morgan('dev'));

app.use((req, res, next) => {
    const shouldCheckDb = req.path.startsWith('/api/auth') || req.path.startsWith('/api/chats') || req.path.startsWith('/api/upload');
    if (!shouldCheckDb) {
        return next();
    }

    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            message: 'Database temporarily unavailable. Please try again shortly.',
            success: false
        });
    }

    return next();
});

app.use('/api/auth', authRouter);
app.use('/api/chats', chatRouter);
app.use('/api/upload', uploadRouter);

app.use(express.static(publicPath));
app.use(express.static(clientBuildPath));

app.get(/.*/, (req, res) => {
    const isApiRoute = req.path.startsWith('/api');
    const isAssetRequest = path.extname(req.path) !== '';

    if (isApiRoute || isAssetRequest) {
        return res.status(404).end();
    }

    return res.sendFile(path.join(clientBuildPath, 'index.html'));
});
