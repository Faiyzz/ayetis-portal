import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { CLARIFICATION_BUTTON_STATES } from '@ayetis/shared';
import { mockQuery } from '../../test/mocks';

const { Clarification } = vi.hoisted(() => ({
  Clarification: {
    countDocuments: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../../models/Clarification', () => ({ Clarification }));
vi.mock('../../models/Case', () => ({ Case: { findById: vi.fn() } }));
vi.mock('../../models/User', () => ({ User: { findById: vi.fn() } }));
vi.mock('../audit/audit.service', () => ({ recordActivity: vi.fn() }));
vi.mock('../notifications/notifications.service', () => ({
  createNotification: vi.fn(),
  createNotificationsForUsers: vi.fn(),
}));
vi.mock('../../services/email', () => ({
  sendCmsOrFallback: vi.fn(),
  clarificationRepliedTemplate: vi.fn(),
  clarificationRequiredTemplate: vi.fn(),
}));
vi.mock('../users/users.service', () => ({ resolvePermissionsForUserId: vi.fn() }));
vi.mock('../../services/storage.service', () => ({ persistUploadedFile: vi.fn() }));

import {
  countOpenClarifications,
  getClarificationButtonStateForCase,
} from './clarifications.service';

describe('clarifications', () => {
  it('counts open threads on a case', async () => {
    Clarification.countDocuments.mockResolvedValue(2);
    await expect(countOpenClarifications(new Types.ObjectId())).resolves.toBe(2);
  });

  it('maps awaiting-doctor threads to the blue button', async () => {
    Clarification.find.mockReturnValue(mockQuery([{ status: 'awaiting_doctor', isDraft: false }]));
    await expect(getClarificationButtonStateForCase(new Types.ObjectId())).resolves.toBe(
      CLARIFICATION_BUTTON_STATES.BLUE,
    );
  });
});
