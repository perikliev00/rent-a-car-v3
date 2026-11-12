/**
 * Lightweight pub/sub toast store used outside React Query / context.
 * {@link toast} pushes a message; {@link subscribeToasts} powers {@link ToastContainer}.
 * Auto-dismisses after 4s so callers need not manage timers.
 */
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

/** Monotonic id generator for React list keys. */
let toastId = 0;
/** Active React subscribers notified whenever the toast list changes. */
const listeners = new Set<(toasts: Toast[]) => void>();
/** Current toast list held outside React so any module can call {@link toast}. */
let toasts: Toast[] = [];

/** Push a shallow copy of the toast list to every subscriber. */
function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

/**
 * Show a transient toast; removes itself after four seconds.
 *
 * @param message - Text shown in the toast.
 * @param type - Visual tone (`success` | `error` | `info`); defaults to `info`.
 * @remarks Side effect: mutates module state, notifies subscribers, and schedules auto-dismiss.
 */
export function toast(message: string, type: ToastType = 'info') {
  const id = ++toastId;
  toasts = [...toasts, { id, message, type }];
  notify();
  // Auto-dismiss so callers do not need to manage timers.
  setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    notify();
  }, 4000);
}

/**
 * Subscribe to toast list changes; returns an unsubscribe function.
 *
 * @param listener - Callback invoked with the current toast array on each change.
 * @returns Unsubscribe function that removes the listener.
 * @remarks Side effect: adds/removes the listener from the module-level set.
 */
export function subscribeToasts(listener: (items: Toast[]) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type { Toast, ToastType };
