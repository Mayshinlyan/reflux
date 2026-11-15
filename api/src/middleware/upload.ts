import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const parser = multer({
  storage: multer.memoryStorage(), // photos never touch disk
  // Up to three optional text fields (`details`, `portion`, `conditions`) beside the photo; validateInput
  // rejects any other name.
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 3, fieldSize: 4 * 1024, parts: 4 },
}).single('photo');

export const MAX_FRIDGE_PHOTOS = 3;

const photosParser = multer({
  storage: multer.memoryStorage(), // photos never touch disk
  // One to three files in the `photos` field and nothing else: no text fields at all.
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_FRIDGE_PHOTOS, fields: 0, parts: MAX_FRIDGE_PHOTOS },
}).array('photos', MAX_FRIDGE_PHOTOS);

/** The fridge scan: parses a multipart body of up to three `photos`. Anything that is not multipart is rejected in the route. */
export function uploadPhotos(req: Request, res: Response, next: NextFunction) {
  if (!req.is('multipart/form-data')) return next();
  photosParser(req, res, next);
}

/** Parses multipart requests only; JSON requests pass straight through. MulterErrors are mapped in errorHandler. */
export function upload(req: Request, res: Response, next: NextFunction) {
  if (!req.is('multipart/form-data')) return next();
  parser(req, res, next);
}

/** A spoken log is about a minute of compressed audio; this leaves room for a long ramble. */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

const audioParser = multer({
  storage: multer.memoryStorage(), // audio never touches disk
  // One `audio` file and one `context` text field, nothing else.
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 1, fieldSize: 16 * 1024, parts: 2 },
}).single('audio');

/** The spoken log: parses a multipart body of one `audio` file and a `context` field. */
export function uploadAudio(req: Request, res: Response, next: NextFunction) {
  if (!req.is('multipart/form-data')) return next();
  audioParser(req, res, next);
}
