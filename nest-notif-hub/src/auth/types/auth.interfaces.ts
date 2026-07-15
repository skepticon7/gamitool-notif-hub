export interface LoginResult {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
}

export interface OidcProfile {
  id: string;
  displayName?: string;
  emails?: {value: string} [];
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  [key: string]: unknown;
}

