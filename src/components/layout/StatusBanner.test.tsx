import { render, screen, act, fireEvent } from '@testing-library/react';
import { StatusBanner } from './StatusBanner';

// Mock useAuth
const mockRefreshProfile = vi.fn();
const mockAuth = {
  user: null as { id: string } | null,
  profile: null,
  session: null,
  isLoading: false,
  authStatus: 'unauthenticated' as const,
  backendError: false,
  signInWithGoogle: vi.fn(),
  signInWithDiscord: vi.fn(),
  signOut: vi.fn(),
  refreshProfile: mockRefreshProfile,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

// Store original env
const originalEnv = process.env.NEXT_PUBLIC_WARNING_MESSAGE;

afterEach(() => {
  process.env.NEXT_PUBLIC_WARNING_MESSAGE = originalEnv;
  mockAuth.backendError = false;
  mockAuth.user = null;
  mockRefreshProfile.mockClear();
  vi.restoreAllMocks();
});

describe('StatusBanner', () => {
  it('renders nothing when no error and no warning message', () => {
    const { container } = render(<StatusBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows banner when backendError is true', () => {
    mockAuth.backendError = true;
    render(<StatusBanner />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/having trouble connecting/i)).toBeInTheDocument();
  });

  it('can be dismissed', async () => {
    mockAuth.backendError = true;
    render(<StatusBanner />);

    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss warning'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('re-appears when backendError transitions from false to true after dismissal', async () => {
    mockAuth.backendError = true;
    const { rerender } = render(<StatusBanner />);

    fireEvent.click(screen.getByLabelText('Dismiss warning'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Simulate error clearing then reoccurring
    mockAuth.backendError = false;
    rerender(<StatusBanner />);
    mockAuth.backendError = true;
    rerender(<StatusBanner />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('starts health recheck interval when backendError is true and user exists', () => {
    vi.useFakeTimers();
    mockAuth.backendError = true;
    mockAuth.user = { id: 'test-user' };

    render(<StatusBanner />);

    expect(mockRefreshProfile).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(mockRefreshProfile).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(mockRefreshProfile).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('does not start recheck interval when user is null', () => {
    vi.useFakeTimers();
    mockAuth.backendError = true;
    mockAuth.user = null;

    render(<StatusBanner />);

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(mockRefreshProfile).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
