import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatCardProps {
    label: string;
    value: ReactNode;
    icon: LucideIcon;
    accentTextClass: string;
    accentBgClass: string;
    flourish?: ReactNode;
}

// Pure layout — icon circle top-right, small label, big value, both tinted
// with the same accent color. Each concrete card (TotalXpStatCard, etc.)
// owns its own data/socket subscription and just renders this.
export function StatCard({ label, value, icon: Icon, accentTextClass, accentBgClass, flourish }: StatCardProps) {
    return (
        <div className="relative rounded-card border border-card-border bg-white p-5 shadow-card">
            <div
                className={`absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full ${accentBgClass}`}
            >
                <Icon size={18} className={accentTextClass} />
            </div>
            <div className={`text-[13px] font-semibold ${accentTextClass}`}>{label}</div>
            <div className={`mt-2 flex items-baseline gap-1.5 text-2xl leading-none font-extrabold ${accentTextClass}`}>
                {value}
                {flourish}
            </div>
        </div>
    );
}
