import { useState, useEffect } from 'react';
import { subscribeNearbyUsers, getBlockedSet } from '../lib/db';

export function useNearbyUsers(currentUid) {
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [blockedSet, setBlockedSet] = useState(new Set());

  useEffect(() => {
    if (!currentUid) return;
    getBlockedSet(currentUid).then(setBlockedSet).catch(() => {});
  }, [currentUid]);

  useEffect(() => {
    if (!currentUid) return;
    const unsub = subscribeNearbyUsers((users) => {
      setNearbyUsers(
        users.filter((u) => u.id !== currentUid && !blockedSet.has(u.id))
      );
    });
    return unsub;
  }, [currentUid, blockedSet]);

  return nearbyUsers;
}
