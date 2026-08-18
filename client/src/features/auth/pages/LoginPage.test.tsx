import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { SlaProgressBar } from '@/features/cases/components/SlaProgressBar';

vi.mock('@/features/auth/store', () => ({
  useAuthStore: Object.assign(
    (selector: (s: { login: typeof login }) => unknown) =>
      selector({ login }),
    {
      getState: () => ({ user: { role: 'doctor' } }),
    },
  ),
}));

const login = vi.fn(async () => {
  throw new Error('Invalid email or password');
});

describe('LoginPage', () => {
  it('stays on login and shows the error when credentials fail', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('Email'), 'doc@test.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
});

describe('SlaProgressBar', () => {
  it('renders URD color utilization', () => {
    const { container } = render(
      <SlaProgressBar utilizationPercent={20} progressColor="green" />,
    );
    expect(container.textContent).toContain('SLA 20%');
    render(<SlaProgressBar utilizationPercent={null} progressColor={null} />);
    expect(screen.getByText('No SLA')).toBeInTheDocument();
    const { container: compact } = render(
      <SlaProgressBar utilizationPercent={90} progressColor="orange" showLabel={false} />,
    );
    expect(compact.textContent).not.toContain('SLA 90%');
  });
});
