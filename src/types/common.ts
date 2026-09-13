/**
 * Shared type definitions.
 */

export type Theme = 'light' | 'white' | 'dark' | 'auto';

export type Language = 'en' | 'ru';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
}
