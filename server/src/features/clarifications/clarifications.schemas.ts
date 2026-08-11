import { z } from 'zod';
import {
  ALL_CLARIFICATION_PRIORITIES,
  ALL_CLARIFICATION_SENDER_ROLES,
} from '@ayetis/shared';

export const createClarificationSchema = z.object({
  subject: z.string().trim().min(3, 'Subject is required').max(200),
  requiredInfo: z.string().trim().min(3, 'Required information is needed').max(5000),
  message: z.string().trim().max(5000).optional(),
  clarificationType: z.string().trim().min(1, 'Clarification type is required').max(80),
  senderRole: z.enum(ALL_CLARIFICATION_SENDER_ROLES as [string, ...string[]]).optional(),
  priority: z.enum(ALL_CLARIFICATION_PRIORITIES as [string, ...string[]]).optional(),
  asDraft: z.boolean().optional(),
});

export const updateDraftSchema = z.object({
  subject: z.string().trim().min(3).max(200).optional(),
  requiredInfo: z.string().trim().min(3).max(5000).optional(),
  clarificationType: z.string().trim().min(1).max(80).optional(),
  priority: z.enum(ALL_CLARIFICATION_PRIORITIES as [string, ...string[]]).optional(),
  doctorResponseDraft: z.string().trim().max(5000).optional(),
  message: z.string().trim().max(5000).optional(),
});

export const replyClarificationSchema = z.object({
  body: z.string().trim().min(1, 'Reply is required').max(5000),
});

export const escalateClarificationSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
  escalate: z.boolean().optional(),
});
