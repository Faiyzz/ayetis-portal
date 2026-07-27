import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { AppError } from '../../utils/AppError';
import {
  openStoredReadStream,
  verifyLocalSignedToken,
} from '../../services/storage.service';

const router = Router();

/**
 * Time-limited file access — no JWT required.
 * Token is issued only after a permission-checked case file request.
 */
router.get('/signed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) throw new AppError('Signed token is required', 400);

    let parsed;
    try {
      parsed = verifyLocalSignedToken(token);
    } catch (error) {
      throw new AppError((error as Error).message || 'Invalid or expired signed URL', 403);
    }

    const { stream, contentLength } = await openStoredReadStream(parsed.storageKey);
    res.setHeader('Content-Type', parsed.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(parsed.originalName)}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    if (contentLength != null) res.setHeader('Content-Length', String(contentLength));
    stream.on('error', (error: Error) => next(error));
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

export default router;
