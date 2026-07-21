export interface LoginResult {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
}

export interface OidcProfile {
  id: string;
  sub: string;
  name: string;
  displayName : string;
  email:  string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  groups: string[];
  [key: string]: unknown;
}

export interface AppJwtPayload {
  sub: string;
  userId: string;
  email: string;
  name: string;
  groups : string[]
}









