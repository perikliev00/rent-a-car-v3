/**
 * Module-scoped toast pub/sub used by API hooks and realtime events.
 */
type ToastType = 'success' | 'error' | 'info';

// Declare the Toast TypeScript interface.
interface Toast {
  // Provide the id field value.
  id: number;
  // Provide the message field value.
  message: string;
  // Provide the type field value.
  type: ToastType;
}

// Initialize the mutable toast id variable.
let toastId = 0;
// Create the listeners constant.
const listeners = new Set<(toasts: Toast[]) => void>();
// Continue the surrounding logic with this statement.
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
  // Create the id constant.
  const id = ++toastId;
  // Update toasts with the right-hand side value.
  toasts = [...toasts, { id, message, type }];
  // Call notify to perform this step.
  notify();
  // Auto-remove this toast only (other toasts keep their own timers).
  setTimeout(() => {
    // Update toasts with the right-hand side value.
    toasts = toasts.filter((item) => item.id !== id);
    // Call notify to perform this step.
    notify();
  // Continue the surrounding logic with this statement.
  }, 4000);
}

/**
 * Subscribe to toast list changes; returns an unsubscribe function.
 * @param listener - Called with a fresh toast array on each change
 */
export function subscribeToasts(listener: (items: Toast[]) => void) {
  // Call listeners.add to perform this step.
  listeners.add(listener);
  // Return the resulting value to the caller.
  return () => {
    // Call listeners.delete to perform this step.
    listeners.delete(listener);
  };
}

// Contribute this line to the enclosing declaration or statement.
export type { Toast, ToastType };
