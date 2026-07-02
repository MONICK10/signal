export function getAnonymousLabel(uid, signals) {
  const anonSignals = signals
    .filter((s) => s.anonymous && s.fromUid)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  const uidMap = {};
  let counter = 1;
  for (const signal of anonSignals) {
    if (!uidMap[signal.fromUid]) {
      uidMap[signal.fromUid] = `Anonymous ${counter++}`;
    }
  }
  return uidMap[uid] || `Anonymous ${counter}`;
}
