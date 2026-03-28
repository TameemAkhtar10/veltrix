import { Router } from "express";
import multer from "multer";
import { authUser, requireVerifiedUser } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import { uploadFiles } from "../controller/upload.controller.js";

const uploadRouter = Router();

uploadRouter.post(
    "/",
    authUser,
    requireVerifiedUser,
    (req, res, next) => {
        upload.array("files")(req, res, (error) => {
            if (!error) return next();

            if (error instanceof multer.MulterError) {
                if (error.code === "LIMIT_FILE_SIZE") {
                    return res.status(400).json({ error: "File too large" });
                }

                if (error.code === "LIMIT_FILE_COUNT") {
                    return res.status(400).json({ error: "Too many files uploaded" });
                }
            }

            return res.status(400).json({ error: error.message || "Upload failed" });
        });
    },
    uploadFiles
);

export default uploadRouter;
