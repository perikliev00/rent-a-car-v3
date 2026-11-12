// Import named exports from '@testing-library/react'.
import { act, renderHook, waitFor } from '@testing-library/react';
// Import named exports from '@tanstack/react-query'.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Contribute this line to the enclosing declaration or statement.
import type { ReactNode } from 'react';
// Import named exports from 'vitest'.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../auth/auth-context'.
import { AuthContext } from '../auth/auth-context';
// Import named exports from '../components/ui/toastStore'.
import { toast } from '../components/ui/toastStore';
// Import named exports from './useAdminRealtime'.
import { noteLocalAdminMutation, useAdminRealtime } from './useAdminRealtime';

// Call vi.mock to perform this step.
vi.mock('../components/ui/toastStore', () => ({
  // Provide the toast field value.
  toast: vi.fn(),
}));

// Declare the Listener TypeScript type alias.
type Listener = (event: MessageEvent<string>) => void;

// Declare the MockEventSource class.
class MockEventSource {
  // Continue the surrounding logic with this statement.
  static instances: MockEventSource[] = [];
  // Provide the url field value.
  url: string;
  // Provide the with credentials field value.
  withCredentials: boolean;
  // Provide the onopen field value.
  onopen: ((ev: Event) => void) | null = null;
  // Provide the onerror field value.
  onerror: ((ev: Event) => void) | null = null;
  // Update listeners with the right-hand side value.
  listeners = new Map<string, Set<Listener>>();
  // Update readyState with the right-hand side value.
  readyState = 0;
  // Update closed with the right-hand side value.
  closed = false;

  // Call constructor to perform this step.
  constructor(url: string, init?: { withCredentials?: boolean }) {
    // Update this.url with the right-hand side value.
    this.url = url;
    // Update this.withCredentials with the right-hand side value.
    this.withCredentials = Boolean(init?.withCredentials);
    // Call MockEventSource.instances.push to perform this step.
    MockEventSource.instances.push(this);
    // Call queueMicrotask to perform this step.
    queueMicrotask(() => {
      // Evaluate the condition and enter the branch when it is true.
      if (!this.closed && this.onopen) {
        // Update this.readyState with the right-hand side value.
        this.readyState = 1;
        // Call onopen to perform this step.
        this.onopen(new Event('open'));
      }
    });
  }

  // Call addEventListener to perform this step.
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    // Create the fn constant.
    const fn = listener as Listener;
    // Evaluate the condition and enter the branch when it is true.
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    // Call listeners.get to perform this step.
    this.listeners.get(type)!.add(fn);
  }

  // Call removeEventListener to perform this step.
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    // Call listeners.get to perform this step.
    this.listeners.get(type)?.delete(listener as Listener);
  }

  // Call close to perform this step.
  close() {
    // Update this.closed with the right-hand side value.
    this.closed = true;
    // Update this.readyState with the right-hand side value.
    this.readyState = 2;
  }

  // Call emit to perform this step.
  emit(type: string, data: object) {
    // Create the event constant.
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    // Iterate using the loop initializer, condition, and step.
    for (const listener of this.listeners.get(type) || []) {
      // Call listener to perform this step.
      listener(event);
    }
  }
}

// Define the staffWrapper function.
function staffWrapper(queryClient: QueryClient) {
  // Return the resulting value to the caller.
  return function Wrapper({ children }: { children: ReactNode }) {
    // Return control to the caller with the following value.
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

// Define the basePayload function.
function basePayload(overrides: Record<string, unknown> = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: 'e1',
    // Provide the occurred at field value.
    occurredAt: new Date().toISOString(),
    // Provide the reservation id field value.
    reservationId: '7',
    // Provide the order id field value.
    orderId: null,
    // Provide the car id field value.
    carId: null,
    // Provide the car name field value.
    carName: null,
    // Provide the customer name field value.
    customerName: null,
    // Provide the status field value.
    status: null,
    // Provide the old status field value.
    oldStatus: null,
    // Provide the message field value.
    message: 'test',
    // Provide the meta field value.
    meta: {},
    // Spread overrides into the surrounding structure.
    ...overrides,
  };
}

// Declare a test suite grouping related cases.
describe('useAdminRealtime', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Update MockEventSource.instances with the right-hand side value.
    MockEventSource.instances = [];
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal('EventSource', MockEventSource);
    // Call vi.mocked to perform this step.
    vi.mocked(toast).mockClear();
    // Call noteLocalAdminMutation to perform this step.
    noteLocalAdminMutation(0);
  });

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Call vi.unstubAllGlobals to perform this step.
    vi.unstubAllGlobals();
  });

  // Define a single test case and its expectations.
  it('connects with credentials and toasts + invalidates on high-signal events', async () => {
    // Create the query client constant.
    const queryClient = new QueryClient({
      // Provide the default options field value.
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Create the invalidate spy constant.
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Destructure object properties into local variables.
    const { result, unmount } = renderHook(() => useAdminRealtime(), {
      // Provide the wrapper field value.
      wrapper: staffWrapper(queryClient),
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(result.current).toBe('live');
    });

    // Assert that the value matches the intended expectation.
    expect(MockEventSource.instances).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(MockEventSource.instances[0].withCredentials).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(MockEventSource.instances[0].url).toContain('/api/v1/admin/realtime/stream');

    // Call act to perform this step.
    act(() => {
      // Continue the surrounding logic with this statement.
      MockEventSource.instances[0].emit(
        // Supply the literal value used by the enclosing expression.
        'payment_failed',
        // Call basePayload to perform this step.
        basePayload({
          // Provide the type field value.
          type: 'payment_failed',
          // Provide the status field value.
          status: 'expired',
          // Provide the old status field value.
          oldStatus: 'pending_payment',
          // Provide the message field value.
          message: 'Payment failed · reservation #7',
        }),
      );
    });

    // Assert that the value matches the intended expectation.
    expect(toast).toHaveBeenCalledWith('Payment failed · reservation #7', 'error');
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'payments'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'reservations'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'dashboard'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'orders'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'calendar'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'tasks'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'fleet-alerts'] });

    // Call unmount to perform this step.
    unmount();
    // Assert that the value matches the intended expectation.
    expect(MockEventSource.instances[0].closed).toBe(true);
  });

  // Define a single test case and its expectations.
  it('quiet events invalidate without toast', async () => {
    // Create the query client constant.
    const queryClient = new QueryClient({
      // Provide the default options field value.
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Create the invalidate spy constant.
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Destructure object properties into local variables.
    const { result } = renderHook(() => useAdminRealtime(), {
      // Provide the wrapper field value.
      wrapper: staffWrapper(queryClient),
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(result.current).toBe('live');
    });

    // Call act to perform this step.
    act(() => {
      // Continue the surrounding logic with this statement.
      MockEventSource.instances[0].emit(
        // Supply the literal value used by the enclosing expression.
        'calendar_updated',
        // Call basePayload to perform this step.
        basePayload({
          // Provide the type field value.
          type: 'calendar_updated',
          // Provide the message field value.
          message: 'Calendar updated',
          // Provide the meta field value.
          meta: { action: 'block_created' },
        }),
      );
    });

    // Assert that the value matches the intended expectation.
    expect(toast).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'calendar'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'tasks'] });

    // Call act to perform this step.
    act(() => {
      // Continue the surrounding logic with this statement.
      MockEventSource.instances[0].emit(
        // Supply the literal value used by the enclosing expression.
        'reservation_updated',
        // Call basePayload to perform this step.
        basePayload({
          // Provide the type field value.
          type: 'reservation_updated',
          // Provide the status field value.
          status: 'picked_up',
          // Provide the message field value.
          message: 'Reservation updated #7 → picked_up',
        }),
      );
    });

    // Assert that the value matches the intended expectation.
    expect(toast).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'reservations'] });
  });

  // Define a single test case and its expectations.
  it('reservation_confirmed invalidates reservation views without fleet-alerts', async () => {
    // Create the query client constant.
    const queryClient = new QueryClient({
      // Provide the default options field value.
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Create the invalidate spy constant.
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Destructure object properties into local variables.
    const { result } = renderHook(() => useAdminRealtime(), {
      // Provide the wrapper field value.
      wrapper: staffWrapper(queryClient),
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(result.current).toBe('live');
    });

    // Call act to perform this step.
    act(() => {
      // Continue the surrounding logic with this statement.
      MockEventSource.instances[0].emit(
        // Supply the literal value used by the enclosing expression.
        'reservation_confirmed',
        // Call basePayload to perform this step.
        basePayload({
          // Provide the type field value.
          type: 'reservation_confirmed',
          // Provide the status field value.
          status: 'confirmed',
          // Provide the message field value.
          message: 'Reservation confirmed #7',
        }),
      );
    });

    // Assert that the value matches the intended expectation.
    expect(toast).toHaveBeenCalledWith('Reservation confirmed #7', 'success');
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'reservations'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'dashboard'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'calendar'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'orders'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'fleet-alerts'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'payments'] });
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['admin', 'notifications'] });
  });

  // Define a single test case and its expectations.
  it('suppresses SSE echo after a local status mutation', async () => {
    // Create the query client constant.
    const queryClient = new QueryClient({
      // Provide the default options field value.
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Create the invalidate spy constant.
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Destructure object properties into local variables.
    const { result } = renderHook(() => useAdminRealtime(), {
      // Provide the wrapper field value.
      wrapper: staffWrapper(queryClient),
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(result.current).toBe('live');
    });

    // Call noteLocalAdminMutation to perform this step.
    noteLocalAdminMutation();
    // Call act to perform this step.
    act(() => {
      // Continue the surrounding logic with this statement.
      MockEventSource.instances[0].emit(
        // Supply the literal value used by the enclosing expression.
        'reservation_confirmed',
        // Call basePayload to perform this step.
        basePayload({
          // Provide the type field value.
          type: 'reservation_confirmed',
          // Provide the status field value.
          status: 'confirmed',
          // Provide the message field value.
          message: 'Reservation confirmed #7',
        }),
      );
    });

    // Assert that the value matches the intended expectation.
    expect(toast).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  it('does not connect for non-staff users', () => {
    // Create the query client constant.
    const queryClient = new QueryClient();
    // Destructure object properties into local variables.
    const { result } = renderHook(() => useAdminRealtime(), {
      // Provide the wrapper field value.
      wrapper: function Wrapper({ children }: { children: ReactNode }) {
        // Return control to the caller with the following value.
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

    // Assert that the value matches the intended expectation.
    expect(result.current).toBe('idle');
    // Assert that the value matches the intended expectation.
    expect(MockEventSource.instances).toHaveLength(0);
  });
});
