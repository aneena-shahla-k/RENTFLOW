import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { env, isCloudinaryConfigured } from '../config/env.js';
import { AppError } from '../utils/errors.js';

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max per image
    files: 6,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new AppError('Only JPEG, PNG, WebP, and GIF images are allowed.', 400, 'INVALID_FILE_TYPE'));
      return;
    }
    cb(null, true);
  },
});

export async function uploadImageBuffer(
  buffer: Buffer,
  mimetype: string,
  folder = 'rentflow'
): Promise<{ url: string; provider: 'cloudinary' | 'local' }> {
  if (isCloudinaryConfigured) {
    const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: 'image',
    });
    return { url: result.secure_url, provider: 'cloudinary' };
  }

  // Safe local upload fallback for development/testing
  const ext = mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const targetPath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(targetPath, buffer);
  return { url: `/uploads/${filename}`, provider: 'local' };
}
