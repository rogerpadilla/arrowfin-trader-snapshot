import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { fetchSnapshot, UnauthorizedError } from './api';

export const SNAPSHOT_QUERY_KEY = ['snapshot'] as const;

export const useSnapshot = () => {
  const router = useRouter();
  const query = useQuery({
    queryKey: SNAPSHOT_QUERY_KEY,
    queryFn: fetchSnapshot,
    retry: (failureCount, error) => !(error instanceof UnauthorizedError) && failureCount < 2,
  });

  useEffect(() => {
    if (query.error instanceof UnauthorizedError) router.replace('/login');
  }, [query.error, router]);

  return query;
};
