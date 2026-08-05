import { io, type Socket } from 'socket.io-client';

export function createSocket(token: string): Socket {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!baseUrl) {
        throw new Error('NEXT_PUBLIC_API_URL is not set');
    }

    return io(baseUrl, { extraHeaders: { Authorization:  `Bearer ${token}` } });
}
