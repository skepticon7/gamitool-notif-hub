export interface AppJwtPayload {
    sub: string;
    userId: string;
    groups: string[];
    email: string;
    name: string;
}

export type UserRole = 'admin' | 'employee';

export interface AuthUser extends AppJwtPayload {
    role: UserRole;
    initials: string;
}