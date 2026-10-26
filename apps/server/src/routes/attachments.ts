import { Router } from "express";
import multer from "multer";
import { LIMITS } from "@hivetalk/shared";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../lib/errors.js";
import {
  getAttachmentForDownload,
  saveUpload,
} from "../services/uploadService.js";

export const attachmentsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.ATTACHMENT_MAX_BYTES, files: 1 },
});

attachmentsRouter.use(requireAuth);

attachmentsRouter.post("/", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      next(new AppError(400, err.message || "Upload failed"));
      return;
    }
    void (async () => {
      try {
        const { user } = req as AuthenticatedRequest;
        if (!req.file) {
          throw new AppError(400, "file is required");
        }
        const attachment = await saveUpload(user.id, {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          buffer: req.file.buffer,
        });
        res.status(201).json({ attachment });
      } catch (error) {
        next(error);
      }
    })();
  });
});

attachmentsRouter.get(
  "/:attachmentId",
  validate(z.object({ attachmentId: z.string().cuid() }), "params"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const { attachment, fullPath } = await getAttachmentForDownload(
        user.id,
        req.params.attachmentId!,
      );
      res.download(fullPath, attachment.filename);
    } catch (error) {
      next(error);
    }
  },
);
