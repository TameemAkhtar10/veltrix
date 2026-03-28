import { generateResponse } from "../services/ai.services.js"
import Chatmodel from "../models/chat.model.js";
import messageModel from "../models/message.model.js";
import { getIO } from "../Sockets/server.socket.js";
import { getRagContext } from "../services/rag.service.js";

const HISTORY_FETCH_LIMIT = Number(process.env.MAX_HISTORY_MESSAGES) || 12;
const MIN_CONTEXT_LENGTH = Number(process.env.RAG_MIN_CONTEXT_LENGTH) || 30;
const MIN_RAG_SCORE = Number(process.env.RAG_MIN_SIMILARITY_SCORE) || 0.5;
const LIVE_SEARCH_KEYWORDS = [
    "current",
    "latest",
    "today",
    "news",
    "price",
    "weather",
    "who is",
    "what happened",
    "score",
    "update",
    "2024",
    "2025",
    "2026",
    "murder",
    "assassinate",
    "assassinated",
    "killed",
    "death",
    "dead",
    "hatya",
    "hatyakand",
    "mar diya",
    "breaking",
    "kaun hai",
    "kya hua"
];

const DATE_TIME_PATTERNS = [
    /\btoday(?:'s)?\s+date\b/i,
    /\bwhat\s+is\s+(?:today(?:'s)?\s+)?date\b/i,
    /\bcurrent\s+date\b/i,
    /\bcurrent\s+time\b/i,
    /\btime\s+now\b/i,
    /\b(?:aaj|aj)\s+ki\s+(?:date|tarikh|tareekh)\b/i,
    /\b(?:aaj|aj)\s+ka\s+din\b/i,
    /\babhi\s+ka\s+time\b/i,
    /\b(?:date|tarikh|tareekh)\s+k(?:y|ya)\s+h(?:ai)?\b/i,
    /\btime\s+k(?:y|ya)\s+h(?:ai)?\b/i
];

const HTML_ENTITY_MAP = {
    "&quot;": '"',
    "&#34;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">"
};

function decodeHtmlEntities(text) {
    return String(text || "").replace(/&quot;|&#34;|&apos;|&#39;|&amp;|&lt;|&gt;/g, (match) => HTML_ENTITY_MAP[match] || match);
}

function normalizeQuotes(text) {
    return String(text || "")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'");
}

function normalizeIncomingMessage(rawMessage) {
    const decoded = decodeHtmlEntities(rawMessage);
    const quoteNormalized = normalizeQuotes(decoded);
    return quoteNormalized.replace(/\s+/g, " ").trim();
}

function needsLiveData(message) {
    const normalized = String(message || "").toLowerCase();
    return LIVE_SEARCH_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isDateTimeQuery(message) {
    const normalized = String(message || "").toLowerCase();
    return DATE_TIME_PATTERNS.some((pattern) => pattern.test(normalized));
}

function getCurrentDateTimeReply() {
    const now = new Date();
    const dateString = now.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

    const timeString = now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    });

    return `Aaj ki date ${dateString} hai, aur current time ${timeString} (IST) hai.`;
}

function generateQuickTitle(message) {
    const cleaned = message.replace(/\s+/g, " ").trim();
    if (!cleaned) return "New Chat";

    const title = cleaned.split(" ").slice(0, 6).join(" ");
    return title.length > 45 ? `${title.slice(0, 45)}...` : title;
}

function emitChatMessage(chatId, messageDoc) {
    try {
        const io = getIO();
        io.to(`chat:${chatId}`).emit("chat_message", {
            id: String(messageDoc?._id || ""),
            chatId: String(chatId),
            role: messageDoc?.role,
            content: messageDoc?.content,
            createdAt: messageDoc?.createdAt,
        });
    } catch (error) {
        // Keep API response flow stable even if socket emission fails.
    }
}

export const createChat = async (req, res) => {
    try {
        const chat = await Chatmodel.create({
            users: req.user?.id,
            title: "New Chat",
        });

        return res.status(201).json({
            message: "Chat created successfully",
            chat,
        });
    } catch (err) {
        console.error("ERROR:", err);
        return res.status(500).json({ error: "fail" });
    }
}

export const sendMessage = async (req, res) => {
    try {
        const { message, chat: chatId } = req.body;
        if (!message || typeof message !== "string") {
            return res.status(400).json({ error: "Message is required" });
        }

        const normalizedMessage = normalizeIncomingMessage(message);
        if (!normalizedMessage) {
            return res.status(400).json({ error: "Message is required" });
        }

        let title = null
        let chat = null;
        let activeChatId = chatId;

        if (!chatId) {
            title = generateQuickTitle(normalizedMessage);
            chat = await Chatmodel.create(
                {
                    users: req.user?.id || null,
                    title: title || "New Chat 🤗"
                }
            );

            activeChatId = chat._id;
        } else {
            chat = await Chatmodel.findById(chatId);
            if (!chat) {
                return res.status(404).json({ error: "Chat not found" });
            }

            title = chat.title || null;
        }

        const previousMessages = await messageModel
            .find({ chat: activeChatId })
            .sort({ createdAt: -1 })
            .limit(HISTORY_FETCH_LIMIT)
            .select("role content -_id")
            .lean();

        const orderedHistory = previousMessages.reverse();

        const userMessage = await messageModel.create({
            chat: activeChatId,
            content: normalizedMessage,
            role: 'user'
        });

        if (isDateTimeQuery(normalizedMessage)) {
            const dateTimeResponse = getCurrentDateTimeReply();
            const aiMessage = await messageModel.create({
                chat: activeChatId,
                content: dateTimeResponse,
                role: "assistant"
            });

            emitChatMessage(activeChatId, aiMessage);

            return res.status(200).json({
                title,
                chat,
                aiMessage
            });
        }
        const forceToolUse = needsLiveData(normalizedMessage);
        const ragResult = await getRagContext({
            query: normalizedMessage,
            userId: req.user?.id,
            chatId: activeChatId,
            limit: 4
        });

        const ragContext = String(ragResult?.context || "");
        const topScore = Number(ragResult?.topScore || 0);
        const hasRelevantRagContext = Boolean(
            ragContext
            && ragContext.trim().length >= MIN_CONTEXT_LENGTH
            && topScore >= MIN_RAG_SCORE
        );

        const ragPrompt = hasRelevantRagContext
            ? `Answer only using the provided context. Do not guess or assume anything. If the answer is not present in the context, say you don't have enough information. Keep answers factual and based only on available data.\n\nRetrieved context:\n${ragContext}`
            : "";

        let response = await generateResponse(normalizedMessage, orderedHistory, ragPrompt, { forceToolUse });
        let aiMessage = await messageModel.create({
            chat: activeChatId,
            content: response,
            role: 'assistant'

        })

        emitChatMessage(activeChatId, aiMessage);

        return res.status(200).json({
            title,
            chat,
            aiMessage: aiMessage,
        })


    } catch (err) {
        console.error("ERROR:", err);
        res.status(500).json({ error: "fail" })
    }
}

export const getChats = async (req, res) => {
    try {
        let chats = await Chatmodel.find({ users: req.user.id }).sort({ updatedAt: -1 })
        res.status(200).json({
            chats
        })
    }
    catch (err) {
        console.error("ERROR:", err);
        res.status(500).json({ error: "fail" })
    }
}

export const getMessages = async (req, res) => {
    try {
        let { chatId } = req.params
        let chats = await Chatmodel.findOne({ _id: chatId, users: req.user.id })

        if (!chats) {
            return res.status(404).json({
                message: "Chat not found",
                success: false
            })
        }
        let messages = await messageModel.find({ chat: chatId })
        res.status(200).json({
            message: "Messages retrieved successfully",
            messages
        })
    }
    catch (err) {
        console.error("ERROR:", err);
        res.status(500).json({ error: "fail" })
    }
}

export const deleteChat = async (req, res) => {
    try {
        let { chatId } = req.params
        let chat = await Chatmodel.findOneAndDelete({ _id: chatId, users: req.user.id })
        if (!chat) {
            return res.status(404).json({
                message: "Chat not found",
                success: false
            })
        }
        await messageModel.deleteMany({ chat: chatId })
        res.status(200).json({
            message: "Chat deleted successfully",
        })
    }
    catch (err) {

        console.error("ERROR:", err);
        res.status(500).json({ error: "fail" })
    }


}



