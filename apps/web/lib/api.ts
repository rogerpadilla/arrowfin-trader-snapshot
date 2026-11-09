import type { DevFillRequest, DevLoginRequest, FillEvent, TraderSnapshotView } from 'contracts';

export class UnauthorizedError extends Error {
  constructor() {
    super('Session expired');
  }
}

const request = async (path: string, body?: object): Promise<Response> => {
  const response = await fetch(
    `/api${path}`,
    body
      ? {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response;
};

export const fetchSnapshot = async (): Promise<TraderSnapshotView> =>
  (await request('/me/snapshot')).json();

export const logout = async (): Promise<void> => {
  await request('/auth/logout', {});
};

export const devLogin = async (identity: DevLoginRequest): Promise<void> => {
  await request('/dev/login', identity);
};

export const simulateFill = async (fill: DevFillRequest): Promise<FillEvent> =>
  (await request('/dev/fills', fill)).json();
