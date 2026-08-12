import { useState, useCallback } from 'react';
import { useConnectivity } from '../context/ConnectivityContext';
import { useToast } from '../context/ToastContext';
import { hapticWarning } from './haptics';

const ACTION_TIMEOUT = 15000;

export function useNetworkAction() {
  const [loading, setLoading] = useState(false);
  const { isConnected } = useConnectivity();
  const toast = useToast();

  const run = useCallback(async (action) => {
    if (!isConnected) {
      hapticWarning();
      toast.error('No internet connection');
      return null;
    }
    setLoading(true);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), ACTION_TIMEOUT)
      );
      const result = await Promise.race([action(), timeoutPromise]);
      return result;
    } catch (error) {
      if (error.message === 'timeout') {
        hapticWarning();
        toast.error('Slow connection — try again');
      } else {
        toast.error('Something went wrong — try again');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  const wrap = useCallback((action) => {
    return () => run(action);
  }, [run]);

  return { loading, run, wrap, isConnected };
}
