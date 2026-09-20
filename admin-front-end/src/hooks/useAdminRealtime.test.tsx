import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/auth-context';
import { toast } from '../components/ui/toastStore';
import { noteLocalAdminMutation, useAdminRealtime } from './useAdminRealtime';

vi.mock('../components/ui/toastStore', () => ({
  toast: vi.fn(),
}));

type Listener = (event: MessageEvent<string>) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  listeners = new Map<string, Set<Listener>>();
  readyState = 0;
  closed = false;

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = Boolean(init?.withCredentials);
    MockEventSource.instances.push(this);
    queueMicrotask(() => {
      if (!this.closed && this.onopen) {
        this.readyState = 1;
        this.onopen(new Event('open'));
      }
    });
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const fn = listener as Listener;
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.get(type)?.delete(listener as Listener);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  emit(type: string, data: object) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    for (const listener of this.listeners.get(type) || []) {
      listener(event);
    }
  }
}

function staffWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: {
              id: '1',
              email: 'admin@example.com',
              role: 'admin',
              roles: ['owner'],
              permissions: ['can_view_reservations_ops'],
            },
            isLoading: false,
            login: vi.fn(),
            signup: vi.fn(),
            logout: vi.fn(),
            refresh: vi.fn(),
          }}
        >
          {children}
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  };
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    occurredAt: new Date().toISOString(),
    reservationId: '7',
    orderId: null,
    carId: null,
    carName: null,
    customerName: null,
    status: null,
    oldStatus: null,
    message: 'test',
    meta: {},
    ...overrides,
  };
}

describe('useAdminRealtime', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    vi.mocked(toast).mockClear();
    noteLocalAdminMutation(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects with credentials and toasts + invalidates on high-signal events', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result, unmount } = renderHook(() => useAdminRealtime(), {
      wrapper: staffWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current).toBe('live');
    });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].withCredentials).toBe(true);
    expect(MockEventSource.instances[0].url).toContain('/api/v1/admin/realtime/stream');

    act(() => {
      MockEventSource.instances[0].emit(
        'payment_failed',
        basePayload({
          type: 'payment_failed',
          status: 'expired',
          oldStatus: 'pending_payment',
          message: 'Payment failed · reservation #7',
        }),
      );
    });

    expect(toast).toHaveBeenCalledWith('Payment failed · reservation #7', 'error');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'payments'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'reservations'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'dashboard'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'orders'] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'calendar'] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'tasks'] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'fleet-alerts'] });

    unmount();
    expect(MockEventSource.instances[0].closed).toBe(true);
  });

  it('quiet events invalidate without toast', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAdminRealtime(), {
      wrapper: staffWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current).toBe('live');
    });

    act(() => {
      MockEventSource.instances[0].emit(
        'calendar_updated',
        basePayload({
          type: 'calendar_updated',
          message: 'Calendar updated',
          meta: { action: 'block_created' },
        }),
      );
    });

    expect(toast).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'calendar'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'tasks'] });

    act(() => {
      MockEventSource.instances[0].emit(
        'reservation_updated',
        basePayload({
          type: 'reservation_updated',
          status: 'picked_up',
          message: 'Reservation updated #7 → picked_up',
        }),
      );
    });

    expect(toast).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'reservations'] });
  });

  it('reservation_confirmed invalidates reservation views without fleet-alerts', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAdminRealtime(), {
      wrapper: staffWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current).toBe('live');
    });

    act(() => {
      MockEventSource.instances[0].emit(
        'reservation_confirmed',
        basePayload({
          type: 'reservation_confirmed',
          status: 'confirmed',
          message: 'Reservation confirmed #7',
        }),
      );
    });

    expect(toast).toHaveBeenCalledWith('Reservation confirmed #7', 'success');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'reservations'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'dashboard'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'calendar'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'orders'] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'fleet-alerts'] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'payments'] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'notifications'] });
  });

  it('suppresses SSE echo after a local status mutation', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAdminRealtime(), {
      wrapper: staffWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current).toBe('live');
    });

    noteLocalAdminMutation();
    act(() => {
      MockEventSource.instances[0].emit(
        'reservation_confirmed',
        basePayload({
          type: 'reservation_confirmed',
          status: 'confirmed',
          message: 'Reservation confirmed #7',
        }),
      );
    });

    expect(toast).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('does not connect for non-staff users', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useAdminRealtime(), {
      wrapper: function Wrapper({ children }: { children: ReactNode }) {
        return (
          <QueryClientProvider client={queryClient}>
            <AuthContext.Provider
              value={{
                user: { id: '2', email: 'c@d.com', role: 'user' },
                isLoading: false,
                login: vi.fn(),
                signup: vi.fn(),
                logout: vi.fn(),
                refresh: vi.fn(),
              }}
            >
              {children}
            </AuthContext.Provider>
          </QueryClientProvider>
        );
      },
    });

    expect(result.current).toBe('idle');
    expect(MockEventSource.instances).toHaveLength(0);
  });
});
