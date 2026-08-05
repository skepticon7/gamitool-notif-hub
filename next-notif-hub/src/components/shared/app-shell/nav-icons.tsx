interface IconProps {
    className?: string;
}

const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

export function DashboardIcon({ className }: IconProps) {
    return (
        <svg {...commonProps} className={className}>
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
    );
}

export function MissionsIcon({ className }: IconProps) {
    return (
        <svg {...commonProps} className={className}>
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
    );
}

export function BadgesIcon({ className }: IconProps) {
    return (
        <svg {...commonProps} className={className}>
            <circle cx="12" cy="8" r="6" />
            <path d="m9 13.5-1.5 8 4.5-3 4.5 3L15 13.5" />
        </svg>
    );
}

export function RulesIcon({ className }: IconProps) {
    return (
        <svg {...commonProps} className={className}>
            <rect x="2" y="4" width="7" height="6" rx="1.5" />
            <rect x="15" y="14" width="7" height="6" rx="1.5" />
            <path d="M9 7h4a2 2 0 0 1 2 2v8" />
        </svg>
    );
}

export function SchedulmentsIcon({ className }: IconProps) {
    return (
        <svg {...commonProps} className={className}>
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M3 9h18M8 2v4M16 2v4" />
            <path d="m9 15 2 2 4-4" />
        </svg>
    );
}

export function CatalogIcon({ className }: IconProps) {
    return (
        <svg {...commonProps} className={className}>
            <path d="M4 4h16v4H4zM4 12h10v8H4zM18 12h2v8h-2z" />
        </svg>
    );
}

export function EngineActivityIcon({ className }: IconProps) {
    return (
        <svg {...commonProps} className={className}>
            <path d="M4 6h16M4 12h16M4 18h10" />
            <circle cx="18" cy="18" r="2.5" />
        </svg>
    );
}

export function SignOutIcon({ className }: IconProps) {
    return (
        <svg {...commonProps} className={className}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
        </svg>
    );
}

export function BellIcon({ className }: IconProps) {
    return (
        <svg {...commonProps} className={className}>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
    );
}
