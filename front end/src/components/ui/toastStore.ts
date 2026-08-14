type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners = new Set<(toasts: Toast[]) => void>();
let toasts: Toast[] = [];

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

export function toast(message: string, type: ToastType = 'info') {
  const id = ++toastId;
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    notify();
  }, 4000);
}

export function subscribeToasts(listener: (items: Toast[]) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type { Toast, ToastType };
