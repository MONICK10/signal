import { useState, useEffect } from 'react';
import { subscribeReceivedSignals } from '../lib/db';

export function useSignals(uid) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeReceivedSignals(uid, (data) => {
      setSignals(data);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { signals, loading };
}
