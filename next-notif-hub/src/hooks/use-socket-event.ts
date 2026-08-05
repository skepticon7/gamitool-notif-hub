import { useContext, useEffect } from 'react';
import { SocketContext } from '@/components/providers/socket-provider';

// Callers should wrap `handler` in useCallback — a new function identity
// every render would otherwise resubscribe on every render too.
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
    const socket = useContext(SocketContext);

    useEffect(() => {
        if (!socket) {
            return;
        }

        socket.on(event, handler);
        return () => {
            socket.off(event, handler);
        };
    }, [socket, event, handler]);
}
