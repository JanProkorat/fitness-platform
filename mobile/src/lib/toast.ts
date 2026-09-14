type ToastEmitter = { show: (message: string, duration?: number) => void }

export const Toast: ToastEmitter = { show: () => {} }
