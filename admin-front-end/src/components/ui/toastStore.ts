/**
 * Module-scoped toast pub/sub used by API hooks and realtime events.
 */
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners = new Set<(toasts: Toast[]) => void>();
let toasts: Toast[] = [];

/** Push the current toast list snapshot to every subscriber. */
function notify() {
  // Copy so React state updates do not share the mutable array reference.
  listeners.forEach((listener) => listener([...toasts]));
}

/**
 * Enqueue a toast and auto-dismiss it after 4 seconds.
 *
 * @param message - User-visible text
 * @param type - Visual tone (default info)
 */
export function toast(message: string, type: ToastType = 'info') {
  const id = ++toastId;
  toasts = [...toasts, { id, message, type }];
  notify();
  // Auto-remove this toast only (other toasts keep their own timers).
  setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    notify();
  }, 4000);
}

/**
 * Subscribe to toast list changes; returns an unsubscribe function.
 * @param listener - Called with a fresh toast array on each change
 */
export function subscribeToasts(listener: (items: Toast[]) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type { Toast, ToastType };
