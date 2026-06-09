export function getAnonymousLabel(uid, signals) {
  const anonSignals = signals
    .filter((s) => s.anonymous && s.fromUid)
    .sort((a, b) => {
      const at = a.createdAt?.seconds || 0;
      const bt = b.createdAt?.seconds || 0;
      return at - bt;
    });

  const uidMap = {};
  let counter = 1;
  for (const signal of anonSignals) {
    if (!uidMap[signal.fromUid]) {
      uidMap[signal.fromUid] = `Anonymous ${counter++}`;
    }
  }
  return uidMap[uid] || `Anonymous ${counter}`;
}
