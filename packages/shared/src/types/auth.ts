export type ThemePreference = 'light' | 'dark' | 'system';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  theme: ThemePreference;
}
