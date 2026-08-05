import type { ReactNode } from 'react';
import { AuthGuard } from '../auth-guard';
import { TopBar } from './top-bar';
import { Sidebar } from './sidebar';
import { EmployeeRewardOverlays } from './employee-reward-overlays';
import { PageTransition } from './page-transition';

export function AppShell({ children }: { children: ReactNode }) {
    return (
        <AuthGuard>
            <div className="flex h-screen flex-col overflow-hidden bg-app-background">
                <TopBar />
                <div className="flex min-h-0 flex-1">
                    <Sidebar />
                    <main className="flex-1 overflow-y-auto">
                        <PageTransition>
                            <div className="px-10 py-8">{children}</div>
                        </PageTransition>
                    </main>
                </div>
            </div>
            <EmployeeRewardOverlays />
        </AuthGuard>
    );
}
