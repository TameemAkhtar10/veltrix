import { MistralAIEmbeddings } from "@langchain/mistralai";

const stores = new Map();
const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE) || 1200;
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP) || 180;

let cachedEmbeddings = null;

function getEmbeddings() {
    if (cachedEmbeddings) return cachedEmbeddings;

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        throw new Error("MISTRAL_API_KEY_MISSING");
    }

    cachedEmbeddings = new MistralAIEmbeddings({
        apiKey,
        model: process.env.MISTRAL_EMBEDDING_MODEL || "mistral-embed"
    });

    return cachedEmbeddings;
}

function buildStoreKey(userId, chatId) {
    const normalizedUser = String(userId || "anonymous");
    const normalizedChat = String(chatId || "global");
    return `${normalizedUser}:${normalizedChat}`;
}

function getOrCreateStore(key) {
    const existing = stores.get(key);
    if (existing) return existing;

    const store = [];
    stores.set(key, store);
    return store;
}

function recursiveSplit(text = "", separators = ["\n\n", "\n", ". ", " ", ""], maxChunk = CHUNK_SIZE) {
    const input = String(text || "").trim();
    if (!input) return [];
    if (input.length <= maxChunk) return [input];

    const [separator, ...restSeparators] = separators;

    if (separator === "") {
        const chunks = [];
        let start = 0;
        while (start < input.length) {
            const end = Math.min(input.length, start + maxChunk);
            chunks.push(input.slice(start, end));
            start += Math.max(1, maxChunk - CHUNK_OVERLAP);
        }
        return chunks;
    }

    const parts = input.split(separator);
    if (parts.length <= 1) {
        return recursiveSplit(input, restSeparators, maxChunk);
    }

    const chunks = [];
    let current = "";

    for (const part of parts) {
        const candidate = current ? `${current}${separator}${part}` : part;

        if (candidate.length <= maxChunk) {
            current = candidate;
            continue;
        }

        if (current) {
            chunks.push(current.trim());
            current = "";
        }

        if (part.length > maxChunk) {
            const nested = recursiveSplit(part, restSeparators, maxChunk);
            chunks.push(...nested);
        } else {
            current = part;
        }
    }

    if (current) {
        chunks.push(current.trim());
    }

    return chunks.filter(Boolean);
}

function toChunkRecords(parsedFiles = [], userId, chatId) {
    const rows = [];

    parsedFiles.forEach((item, index) => {
        const splits = recursiveSplit(item.text || "");
        splits.forEach((chunk, chunkIndex) => {
            rows.push({
                content: chunk,
                metadata: {
                    source: item.fileName,
                    type: item.type,
                    userId: String(userId || ""),
                    chatId: String(chatId || "global"),
                    index,
                    chunkIndex
                }
            });
        });
    });

    return rows;
}

function cosineSimilarity(a = [], b = []) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0 || a.length !== b.length) {
        return -1;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i += 1) {
        const av = Number(a[i] || 0);
        const bv = Number(b[i] || 0);
        dot += av * bv;
        normA += av * av;
        normB += bv * bv;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (!denom) return -1;
    return dot / denom;
}

function toPublicRows(rows = []) {
    return rows.map((item) => ({
        content: item.content,
        source: item.source || "uploaded_file"
    }));
}

function toStoreRows(parsedFiles = [], userId, chatId) {
    return toChunkRecords(parsedFiles, userId, chatId).map((item) => ({
        pageContent: item.content,
        metadata: {
            source: item.metadata?.source,
            type: item.metadata?.type,
            userId: String(userId || ""),
            chatId: String(chatId || "global"),
            index: item.metadata?.index,
            chunkIndex: item.metadata?.chunkIndex
        }
    }));
}

export async function upsertFileTextsToVectorStore({ parsedFiles = [], userId, chatId }) {
    if (!Array.isArray(parsedFiles) || parsedFiles.length === 0) {
        return { indexedChunks: 0 };
    }

    const rows = toStoreRows(parsedFiles, userId, chatId);
    if (rows.length === 0) {
        return { indexedChunks: 0, files: [] };
    }

    const embeddingsModel = getEmbeddings();
    const vectors = await embeddingsModel.embedDocuments(rows.map((item) => item.pageContent));

    const key = buildStoreKey(userId, chatId);
    const store = getOrCreateStore(key);

    const records = rows.map((item, idx) => ({
        pageContent: item.pageContent,
        metadata: item.metadata,
        embedding: vectors[idx]
    }));
    store.push(...records);

    return {
        indexedChunks: rows.length,
        files: parsedFiles.map((item) => item.fileName)
    };
}

export async function getRagContext({ query, userId, chatId, limit = 4 }) {
    if (!query || typeof query !== "string") {
        return {
            context: "",
            topScore: 0,
            matchedTypes: []
        };
    }

    const chatKey = buildStoreKey(userId, chatId);
    const globalKey = buildStoreKey(userId, "global");

    const chatStore = stores.get(chatKey);
    const globalStore = stores.get(globalKey);
    const candidates = [];

    if (chatStore) {
        candidates.push(...chatStore);
    }

    if (globalStore && globalKey !== chatKey) {
        candidates.push(...globalStore);
    }

    if (candidates.length === 0) {
        return {
            context: "",
            topScore: 0,
            matchedTypes: []
        };
    }

    const queryEmbedding = await getEmbeddings().embedQuery(query);
    const scored = candidates
        .map((item) => ({
            ...item,
            score: cosineSimilarity(queryEmbedding, item.embedding)
        }))
        .filter((item) => Number.isFinite(item.score) && item.score > -1)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(limit * 2, limit));

    if (scored.length === 0) {
        return {
            context: "",
            topScore: 0,
            matchedTypes: []
        };
    }

    const topScore = Number(scored[0]?.score || 0);

    const uniqueByContent = new Map();
    const matchedTypes = new Set();
    for (const doc of scored) {
        const content = String(doc?.pageContent || "").trim();
        if (!content || uniqueByContent.has(content)) continue;

        const matchedType = String(doc?.metadata?.type || "").toLowerCase();
        if (matchedType) {
            matchedTypes.add(matchedType);
        }

        uniqueByContent.set(content, {
            content,
            source: doc?.metadata?.source || "uploaded_file"
        });
    }

    const context = toPublicRows([...uniqueByContent.values()])
        .slice(0, limit)
        .map((item, idx) => `[${idx + 1}] Source: ${item.source}\n${item.content}`)
        .join("\n\n");

    return {
        context,
        topScore,
        matchedTypes: [...matchedTypes]
    };
}
