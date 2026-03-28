import fs from "node:fs/promises";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

function normalizeText(text = "") {
    return String(text || "").replace(/\s+/g, " ").trim();
}

function resolveSourceName(file = {}) {
    return file.originalname || file.filename || "file";
}

async function getBuffer(file = {}) {
    if (file.buffer) return file.buffer;
    if (file.path) return fs.readFile(file.path);
    throw new Error("FILE_BUFFER_NOT_FOUND");
}

function detectType(file = {}) {
    const name = String(file.originalname || "").toLowerCase();
    const mimetype = String(file.mimetype || "").toLowerCase();

    if (mimetype.includes("pdf") || name.endsWith(".pdf")) return "pdf";
    if (mimetype.includes("wordprocessingml") || name.endsWith(".docx")) return "docx";
    if (mimetype.startsWith("text/") || name.endsWith(".txt")) return "txt";
    if (mimetype.startsWith("image/")) return "image";

    return "unknown";
}

async function parsePdf(buffer) {
    const parsed = await pdfParse(buffer);
    return normalizeText(parsed?.text || "");
}

async function parseDocx(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeText(result?.value || "");
}

async function parseTxt(buffer) {
    return normalizeText(buffer.toString("utf8"));
}

async function parseImage(buffer, mimeType) {
    const base64Image = buffer.toString("base64");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`
                            }
                        },
                        {
                            type: "text",
                            text: "Describe everything visible in this image in detail. Include people, objects, text, colors, layout, and context."
                        }
                    ]
                }
            ]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Groq Vision API error:", errorData);
        throw new Error("VISION_API_FAILED");
    }

    const data = await response.json();
    const description = String(data?.choices?.[0]?.message?.content || "").trim();

    if (!description || description.length < 10) {
        throw new Error("IMAGE_TEXT_NOT_CLEAR");
    }

    return normalizeText(description);
}

export async function parseFileToText(file = {}) {
    const type = detectType(file);
    const buffer = await getBuffer(file);

    if (type === "pdf") {
        return {
            fileName: resolveSourceName(file),
            text: await parsePdf(buffer),
            type
        };
    }

    if (type === "docx") {
        return {
            fileName: resolveSourceName(file),
            text: await parseDocx(buffer),
            type
        };
    }

    if (type === "txt") {
        return {
            fileName: resolveSourceName(file),
            text: await parseTxt(buffer),
            type
        };
    }

    if (type === "image") {
        return {
            fileName: resolveSourceName(file),
            text: await parseImage(buffer, file.mimetype),
            type
        };
    }

    throw new Error("UNSUPPORTED_FILE_TYPE");
}

export async function parseManyFiles(files = []) {
    const parsedFiles = [];

    for (const file of files) {
        const parsed = await parseFileToText(file);
        if (parsed?.text) {
            parsedFiles.push(parsed);
        }
    }

    return parsedFiles;
}
