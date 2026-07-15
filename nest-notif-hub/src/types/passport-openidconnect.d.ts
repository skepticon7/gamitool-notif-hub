// declare module 'passport-openidconnect' {
//   import { Strategy as PassportStrategyBase } from 'passport-strategy';
//
//   export interface Profile {
//     id: string;
//     displayName?: string;
//     username?: string;
//     emails?: { value: string }[];
//     photos?: { value: string }[];
//     [key: string]: unknown;
//   }
//
//   export type VerifyCallback = (
//     err: Error | null,
//     user?: unknown,
//     info?: unknown,
//   ) => void;
//
//   export interface StrategyOptions {
//     issuer: string;
//     authorizationURL: string;
//     tokenURL: string;
//     userInfoURL: string;
//     clientID: string;
//     clientSecret: string;
//     callbackURL: string;
//     scope?: string | string[];
//     [key: string]: unknown;
//   }
//
//   export type VerifyCallback = (
//     err: Error | null,
//     user?: unknown,
//     info?: unknown,
//   ) => void;
//
//   export type VerifyFunction = (
//     issuer: string,
//     profile: Profile,
//     context: unknown,
//     idToken: string,
//     accessToken: string,
//     refreshToken: string,
//     params: unknown,
//     done: VerifyCallback,
//   ) => void;
//
//   export class Strategy extends PassportStrategyBase {
//     constructor(options: StrategyOptions, verify: VerifyFunction);
//     name: string;
//   }
// }
