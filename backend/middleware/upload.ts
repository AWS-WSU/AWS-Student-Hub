import type { Request } from 'express';
import multer from 'multer';
import logger from '../config/logger';

const log = logger.child({ module: 'upload' });

type SharpPipeline = {
  resize(width: number, height: number, options: Record<string, unknown>): SharpPipeline;
  jpeg(options: Record<string, unknown>): SharpPipeline;
  toBuffer(): Promise<Buffer>;
};

type SharpFactory = (buffer: Buffer) => SharpPipeline;

let sharpFactoryPromise: Promise<SharpFactory | null> | null = null;

const loadSharp = async (): Promise<SharpFactory | null> => {
  if (!sharpFactoryPromise) {
    sharpFactoryPromise = import('sharp')
      .then((module) => (module.default ?? module) as unknown as SharpFactory)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        log.warn('sharp module not available; image processing disabled.', message);
        return null;
      });
  }

  return sharpFactoryPromise;
};

const storage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (_req: Request, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const processImage = async (buffer: Buffer): Promise<Buffer> => {
  const sharp = await loadSharp();

  if (!sharp) {
    log.warn('sharp not available; returning original image buffer.');
    return buffer;
  }

  try {
    return await sharp(buffer)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn('image processing failed; returning original image buffer.', message);
    return buffer;
  }
};
