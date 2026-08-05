'use client';

import { createContext, useEffect, useMemo, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth-store';

export const SocketContext = createContext<Socket | null>(null);

// One shared connection for the whole app — components subscribe to it via
// useSocketEvent rather than each opening their own socket. Connects once a
// real access token exists and disconnects on sign-out / token loss.
export function SocketProvider({ children }: { children: ReactNode }) {
    const accessToken = useAuthStore((s) => s.accessToken);

    // Deriving the socket via useMemo (not useState+useEffect) — creating
    // an `io()` client is cheap and side-effect-free until it actually
    // connects (which it manages internally, including buffering any
    // .on() listeners registered before the handshake completes), so this
    // isn't the kind of impure work useMemo is meant to avoid. The only
    // real effect needed is disconnecting the *previous* socket when the
    // token changes or the provider unmounts.
    const socket = useMemo(() => (accessToken ? createSocket(accessToken) : null), [accessToken]);

    // Explicit .connect() here (not just relying on io()'s autoConnect) is
    // what makes this survive React Strict Mode's dev-only double-invoke of
    // effects: mount -> cleanup -> mount again. The cleanup's .disconnect()
    // is a *manual* disconnect, which Socket.IO never auto-reconnects from —
    // without re-calling .connect() on the second mount, the socket stays
    // permanently dead even though the component is actually still alive.
    useEffect(() => {
        if (!socket) {
            return;
        }

        socket.connect();
        return () => {
            socket.disconnect();
        };
    }, [socket]);

    return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
