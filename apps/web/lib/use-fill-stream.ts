import { useQueryClient } from '@tanstack/react-query';
import { FILL_EVENT, type FillEvent, SOCKET_UNAUTHORIZED } from 'contracts';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SNAPSHOT_QUERY_KEY } from './use-snapshot';

/** `live` is the only state in which the numbers on screen can be trusted to be current. */
export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'signed-out';

const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001';

/** Fills arriving within this window share one snapshot refetch, issued when the window closes. */
const REFRESH_WINDOW_MS = 150;

/** Runs `task` once, `windowMs` after the first of any number of `schedule()` calls in that window. */
const coalesce = (task: () => void, windowMs: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule: () => {
      timer ??= setTimeout(() => {
        timer = undefined;
        task();
      }, windowMs);
    },
    cancel: () => clearTimeout(timer),
  };
};

/**
 * The socket only signals that something changed; the snapshot endpoint stays the single source of truth.
 * Every (re)connect refetches the snapshot, which closes the gap between the initial fetch and the
 * subscription, and any gap while the socket was down.
 */
export const useFillStream = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [lastFill, setLastFill] = useState<FillEvent>();

  useEffect(() => {
    const refresh = coalesce(
      () => void queryClient.invalidateQueries({ queryKey: SNAPSHOT_QUERY_KEY }),
      REFRESH_WINDOW_MS,
    );
    const socket = io(socketUrl, { transports: ['websocket'], withCredentials: true });

    socket.on('connect', () => {
      setStatus('live');
      refresh.schedule();
    });
    socket.on('disconnect', (reason) => {
      // The server closes the socket itself when the session expires; that one does not auto-reconnect.
      setStatus(reason === 'io server disconnect' ? 'signed-out' : 'reconnecting');
    });
    socket.on('connect_error', (error) => {
      setStatus(error.message === SOCKET_UNAUTHORIZED ? 'signed-out' : 'reconnecting');
    });
    socket.on(FILL_EVENT, (fill: FillEvent) => {
      setLastFill(fill);
      refresh.schedule();
    });

    return () => {
      refresh.cancel();
      socket.close();
    };
  }, [queryClient]);

  return { status, lastFill };
};
