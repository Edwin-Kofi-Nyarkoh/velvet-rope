import crypto from "node:crypto";
import { env } from "../env";
import { AppError } from "../lib/http";

function requireCloudinary() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError(503, "CLOUDINARY_NOT_CONFIGURED", "Cloudinary is not configured yet.");
  }
}

export const cloudinaryService = {
  createUploadSignature(folder = "velvet-rope/events") {
    requireCloudinary();
    const timestamp = Math.round(Date.now() / 1000);
    const params = `folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash("sha1").update(params).digest("hex");

    return {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      folder,
      timestamp,
      signature
    };
  }
};
