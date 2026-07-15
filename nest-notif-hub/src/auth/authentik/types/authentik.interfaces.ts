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
