export type Theme = 'light' | 'dark';

export interface ThemeProps {
  theme: Theme;
}

export interface LayoutProps extends ThemeProps {
  toggleTheme: () => void;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: number) => void;
}
