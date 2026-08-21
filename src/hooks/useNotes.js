import { useState, useEffect } from 'react';
import { subscribeNearbyNotes, getBlockedSet } from '../lib/db';

export function useNotes(currentUid) {
  const [notes, setNotes] = useState([]);
  const [blockedSet, setBlockedSet] = useState(new Set());

  useEffect(() => {
    if (!currentUid) return;
    getBlockedSet(currentUid).then(setBlockedSet).catch(() => {});
  }, [currentUid]);

  useEffect(() => {
    if (!currentUid) return;
    const unsub = subscribeNearbyNotes((all) => {
      setNotes(all.filter((n) => n.uid === currentUid || !blockedSet.has(n.uid)));
    });
    return unsub;
  }, [currentUid, blockedSet]);

  return notes;
}
