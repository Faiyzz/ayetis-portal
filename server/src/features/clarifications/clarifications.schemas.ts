import { z } from 'zod';

export const createClarificationSchema = z.object({
  subject: z.string().trim().min(3, 'Subject is required').max(200),
  requiredInfo: z.string().trim().min(3, 'Required information is needed').max(5000),
  message: z.string().trim().max(5000).optional(),
});

export const replyClarificationSchema = z.object({
  body: z.string().trim().min(1, 'Reply is required').max(5000),
});
