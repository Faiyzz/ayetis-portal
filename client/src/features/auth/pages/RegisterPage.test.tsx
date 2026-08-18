import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { RegisterPage } from './RegisterPage';

vi.mock('@/features/settings/api', () => ({
  fetchCountries: vi.fn(async () => [{ id: 'us', name: 'United States', dialCode: '+1' }]),
  fetchMasterListItems: vi.fn(async () => []),
  fetchCurrentPrivacy: vi.fn(async () => ({
    version: '1.0',
    bodyHtml: '<p>Privacy</p>',
    publishedAt: new Date().toISOString(),
  })),
}));

vi.mock('@/features/auth/api', () => ({
  register: vi.fn(),
}));

describe('RegisterPage', () => {
  it('requires accepting the privacy notice before submit', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    await screen.findByText(/Privacy Notice \(v1\.0\)/);
    fireEvent.submit(screen.getByRole('button', { name: /submit registration/i }).closest('form')!);
    expect(
      await screen.findByText('You must accept the Privacy Notice to continue'),
    ).toBeInTheDocument();
  });
});
