import { parseManyFiles } from "../services/fileParser.service.js";
import { upsertFileTextsToVectorStore } from "../services/rag.service.js";

export const uploadFiles = async (req, res) => {
    try {
        const files = req.files || [];
        const { chat } = req.body;
        const userId = req.user?.id;

        if (!Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        const parsedFiles = await parseManyFiles(files);
        if (parsedFiles.length === 0) {
            return res.status(400).json({ error: "No extractable text found in uploaded files" });
        }

        const result = await upsertFileTextsToVectorStore({
            parsedFiles,
            userId,
            chatId: chat || "global"
        });

        return res.status(200).json({
            success: true,
            message: "Files uploaded and indexed",
            fileCount: parsedFiles.length,
            indexedChunks: result.indexedChunks,
            files: result.files
        });
    } catch (error) {
        if (error?.message === "MISTRAL_API_KEY_MISSING") {
            return res.status(500).json({ error: "MISTRAL_API_KEY is required for embeddings" });
        }

        if (error?.message === "IMAGE_TEXT_NOT_CLEAR") {
            return res.status(400).json({ error: "Only limited details are visible from this image. Please upload a clearer image for better analysis." });
        }

        if (error?.message?.includes("Unsupported file type")) {
            return res.status(400).json({ error: error.message });
        }
        console.error("Upload error:", error?.message, error);
        return res.status(500).json({ error: "Failed to process uploaded files" });
    }
};
