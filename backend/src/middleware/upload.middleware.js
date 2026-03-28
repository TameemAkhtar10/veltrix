import multer from "multer";

const MAX_FILE_SIZE = Number(process.env.MAX_UPLOAD_FILE_SIZE_MB || 10) * 1024 * 1024;
const MAX_FILES = Number(process.env.MAX_UPLOAD_FILES || 8);

const allowedMimeTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif"
]);

const allowedExtensions = new Set([".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function hasAllowedExtension(filename = "") {
    const index = filename.lastIndexOf(".");
    if (index === -1) return false;
    const ext = filename.slice(index).toLowerCase();
    return allowedExtensions.has(ext);
}

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
    const mimeAllowed = allowedMimeTypes.has(String(file?.mimetype || "").toLowerCase());
    const extAllowed = hasAllowedExtension(file?.originalname || "");

    if (!mimeAllowed && !extAllowed) {
        return cb(new Error("Unsupported file type. Allowed: PDF, DOCX, TXT, PNG, JPG, WEBP, GIF"));
    }

    return cb(null, true);
}

export const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES
    },
    fileFilter
});
