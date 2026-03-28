import express from 'express';
import authRouter from './routes/auth.routes.js';
import chatRouter from './routes/chat.routes.js';
import uploadRouter from './routes/upload.routes.js';
import cookiepareser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';



export let app = express();

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173',
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

app.get('/', (req, res) => {
    res.send("Hello world")
})