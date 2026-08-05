export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface Badge {
    id: string;
    name: string;
    description: string | null;
    threshold: number;
    tier: BadgeTier;
    createdAt: string;
    updatedAt: string;
}

export interface CreateBadgeInput {
    name: string;
    threshold: number;
    tier: BadgeTier;
    description?: string;
}

export type UpdateBadgeInput = Partial<CreateBadgeInput>;

// `badge:granted` socket payload (backend TBD) — the full Badge object,
// same shape as GET /badges/my-badges items.
export interface BadgeGrantedPayload {
    badge: Badge;
}
