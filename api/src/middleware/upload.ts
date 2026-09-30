import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const parser = multer({
  storage: multer.memoryStorage(), // photos never touch disk
  // One optional text field (`details`) beside the photo; anything else is rejected.
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 1, fieldSize: 4 * 1024, parts: 3 },
}).single('photo');

/** Parses multipart requests only; JSON requests pass straight through. MulterErrors are mapped in errorHandler. */
export function upload(req: Request, res: Response, next: NextFunction) {
  if (!req.is('multipart/form-data')) return next();
  parser(req, res, next);
}
