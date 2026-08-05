'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MissionsTable } from '@/features/missions';
import { BadgesTable } from '@/features/badges';

type CatalogTab = 'missions' | 'badges';

export default function AdminCatalogPage() {
    const [activeTab, setActiveTab] = useState<CatalogTab>('missions');
    const [missionFormOpen, setMissionFormOpen] = useState(false);
    const [badgeFormOpen, setBadgeFormOpen] = useState(false);

    return (
        <div>
            <div className="mb-5">
                <h1 className="mb-1 text-[27px] font-extrabold text-foreground">Missions &amp; Badges</h1>
                <p className="text-[15px] text-gray">
                    Manage the catalog. Missions with no duration never get a deadline, reminders, or expiry.
                </p>
            </div>

            <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('missions')}
                        className={`h-10 cursor-pointer rounded-[11px] px-4 text-[13.5px] font-bold ${
                            activeTab === 'missions'
                                ? 'bg-primary text-white'
                                : 'bg-white text-foreground hover:bg-muted'
                        }`}
                    >
                        Missions
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('badges')}
                        className={`h-10 cursor-pointer rounded-[11px] px-4 text-[13.5px] font-bold ${
                            activeTab === 'badges' ? 'bg-primary text-white' : 'bg-white text-foreground hover:bg-muted'
                        }`}
                    >
                        Badges
                    </button>
                </div>

                <Button
                    type="button"
                    onClick={() => (activeTab === 'missions' ? setMissionFormOpen(true) : setBadgeFormOpen(true))}
                    className="cursor-pointer gap-1.5 rounded-button bg-primary font-bold text-white"
                >
                    <Plus size={16} />
                    {activeTab === 'missions' ? 'New mission' : 'New badge'}
                </Button>
            </div>

            {activeTab === 'missions' ? (
                <MissionsTable createOpen={missionFormOpen} onCreateOpenChange={setMissionFormOpen} />
            ) : (
                <BadgesTable createOpen={badgeFormOpen} onCreateOpenChange={setBadgeFormOpen} />
            )}
        </div>
    );
}
