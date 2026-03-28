import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatMistralAI } from "@langchain/mistralai";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { tavilySearch } from "./tavilySearch.js";
const RESPONSE_TIMEOUT_MS = Number(process.env.AI_RESPONSE_TIMEOUT_MS) || 20000;
const TITLE_TIMEOUT_MS = Number(process.env.AI_TITLE_TIMEOUT_MS) || 3000;
const MAX_HISTORY_MESSAGES = Number(process.env.MAX_HISTORY_MESSAGES) || 12;
const AI_TEMPERATURE = Number(process.env.AI_TEMPERATURE) || 0.2;
const AI_PROVIDER = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "mistral-small-latest";

let cachedGeminiModel = null;
let cachedMistralModel = null;

function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error("AI_TIMEOUT")), timeoutMs);
        })
    ]);
}

async function invokeWithTimeout(model, input, timeoutMs) {
    return withTimeout(model.invoke(input), timeoutMs);
}

function extractModelText(response) {
    if (!response) return "";

    if (typeof response === "string") {
        return response.trim();
    }

    if (typeof response.text === "string") {
        return response.text.trim();
    }

    if (typeof response.content === "string") {
        return response.content.trim();
    }

    if (Array.isArray(response.content)) {
        const joined = response.content
            .map((part) => {
                if (typeof part === "string") return part;
                if (part && typeof part.text === "string") return part.text;
                return "";
            })
            .join(" ")
            .trim();

        return joined;
    }

    return "";
}

function getGeminiModel() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return null;

    if (cachedGeminiModel) return cachedGeminiModel;

    cachedGeminiModel = new ChatGoogleGenerativeAI({
        model: GEMINI_MODEL,
        apiKey,
        temperature: AI_TEMPERATURE
    });

    return cachedGeminiModel;
}

function getMistralModel() {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) return null;

    if (cachedMistralModel) return cachedMistralModel;

    cachedMistralModel = new ChatMistralAI({
        model: MISTRAL_MODEL,
        apiKey,
        temperature: AI_TEMPERATURE
    });

    return cachedMistralModel;
}

function getModelOrder(geminiModel, mistralModel) {
    if (AI_PROVIDER === "mistral") {
        return [mistralModel, geminiModel].filter(Boolean);
    }

    return [geminiModel, mistralModel].filter(Boolean);
}

function buildMessages(message, history = [], extraSystemPrompt = "", forceToolUse = false) {
    const messages = [];

    messages.push(
        new SystemMessage("You are Veltrix AI. For all responses, answer only from available evidence and never guess or assume. If context is not sufficient for a specific claim, clearly say that the visible or provided details are limited. For image requests, analyze the full image context provided to you and describe visible people, objects, text, colors, environment, and layout in a structured way. If a person is visible, describe appearance, clothing, expression, and surroundings based strictly on what is visible. If text appears in the image, include it exactly as seen when possible. When users ask image questions, answer directly and specifically from visible details, and mention uncertainty only for unclear parts. Never invent unseen details. Match the user's language: if user writes in English, reply in English; if user writes in Hindi/Hinglish, reply in natural Hinglish (Roman script). Keep answers clear, conversational, and practical. Prefer plain text, short paragraphs, or bullet points. Avoid markdown tables and pipe separators unless the user explicitly asks for a table. ")
    );

    if (forceToolUse) {
        messages.push(
            new SystemMessage("For this query, live Tavily web results will be provided as context in a later system message. Answer only from those live results for time-sensitive facts and include source URLs.")
        );
    }

    if (extraSystemPrompt && typeof extraSystemPrompt === "string") {
        messages.push(new SystemMessage(extraSystemPrompt));
    }

    const safeHistory = Array.isArray(history)
        ? history.slice(-MAX_HISTORY_MESSAGES)
        : [];

    for (const item of safeHistory) {
        if (!item || typeof item.content !== "string") continue;

        if (item.role === "user") {
            messages.push(new HumanMessage(item.content));
        }

        if (item.role === "assistant") {
            messages.push(new AIMessage(item.content));
        }
    }

    messages.push(new HumanMessage(message));
    return messages;
}

function formatTavilyResults(results) {
    if (!Array.isArray(results) || results.length === 0) {
        return "No Tavily web results were returned.";
    }

    return results
        .slice(0, 5)
        .map((item, index) => {
            const title = item?.title || "Untitled";
            const url = item?.url || "N/A";
            const content = item?.content || item?.snippet || "";

            return `[${index + 1}] ${title}\nURL: ${url}\nSnippet: ${content}`;
        })
        .join("\n\n");
}

async function invokeWithForcedTavilyTool(model, builtMessages, fallbackQuery) {
    if (!process.env.TAVILY_API_KEY) {
        throw new Error("TAVILY_NOT_CONFIGURED");
    }

    const searchResults = await withTimeout(tavilySearch(fallbackQuery), RESPONSE_TIMEOUT_MS);
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
        throw new Error("TAVILY_NO_RESULTS");
    }

    const liveSearchContext = formatTavilyResults(searchResults);
    const liveSearchMessage = new SystemMessage(
        `Tavily live web search results for query: "${fallbackQuery}"\n\n${liveSearchContext}`
    );

    const finalResponse = await invokeWithTimeout(
        model,
        [...builtMessages, liveSearchMessage],
        RESPONSE_TIMEOUT_MS
    );

    const finalText = extractModelText(finalResponse);
    if (!finalText) {
        throw new Error("EMPTY_TOOL_RESPONSE");
    }

    return finalText;
}


export async function generateResponse(messages, history = [], extraSystemPrompt = "", options = {}) {
    try {
        if (!messages || typeof messages !== "string") {
            return "Message is required";
        }

        const normalizedMessage = messages.trim();
        if (!normalizedMessage) {
            return "Message is required";
        }

        const forceToolUse = Boolean(options?.forceToolUse);

        const builtMessages = buildMessages(normalizedMessage, history, extraSystemPrompt, forceToolUse);
        const geminiModel = getGeminiModel();
        const mistralModel = getMistralModel();
        const models = getModelOrder(geminiModel, mistralModel);

        if (models.length === 0) {
            return "Set GEMINI_API_KEY/GOOGLE_API_KEY or MISTRAL_API_KEY in .env";
        }

        for (const model of models) {
            try {
                if (forceToolUse) {
                    return await invokeWithForcedTavilyTool(model, builtMessages, normalizedMessage);
                }

                const response = await invokeWithTimeout(model, builtMessages, RESPONSE_TIMEOUT_MS);
                const text = extractModelText(response);
                if (text) {
                    return text;
                }
            } catch (error) {
                // Try fallback model in the next iteration.
            }
        }

        if (forceToolUse) {
            return "Live search tool call failed. Please try again.";
        }

        return "AI request timed out. Please try again.";
    } catch (error) {
        return "AI service unavailable. Please try again.";
    }
}


export async function generatetitle(message) {
    if (!message || typeof message !== "string") {
        return "New Chat";
    }

    const prompt = [
        new SystemMessage("Generate a short chat title (max 6 words). Return only title text."),
        new HumanMessage(`Message: ${message}`)
    ];

    const geminiModel = getGeminiModel();
    const mistralModel = getMistralModel();
    const models = getModelOrder(geminiModel, mistralModel);

    for (const model of models) {
        try {
            const response = await invokeWithTimeout(model, prompt, TITLE_TIMEOUT_MS);
            const title = extractModelText(response);
            return title || "New Chat";
        } catch (error) {
            // Try fallback model in the next iteration.
        }
    }

    return "New Chat";
}