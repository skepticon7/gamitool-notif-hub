export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}


export interface ExecutorChallenge {
  component: string;
  type?: string;
  to?: string;
  response_errors?: Record<string, { string: string; code: string }[]>;
}

export interface UserInfoResponse {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  nickname?: string;
  groups: string[];
}
