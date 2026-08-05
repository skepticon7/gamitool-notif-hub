import type { Metadata } from 'next';
import { Manrope, Inter } from 'next/font/google';
import { AuthProvider } from '@/components/providers/auth-provider';
import { SocketProvider } from '@/components/providers/socket-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';
import {QueryProvider} from "@/components/providers/query-provider";

const manrope = Manrope({
    variable: '--font-manrope',
    subsets: ['latin'],
});

const inter = Inter({
    variable: '--font-inter',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Gamitool',
    description: 'Missions, XP and rewards — wired to your org’s events.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${manrope.variable} ${inter.variable} h-full antialiased`}>
            <body className="flex min-h-full flex-col">
                <QueryProvider>
                    <AuthProvider>
                        <SocketProvider>{children}</SocketProvider>
                    </AuthProvider>
                </QueryProvider>
                <Toaster position="bottom-right" />
            </body>
        </html>
    );
}
