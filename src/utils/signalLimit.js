import { checkGlobalSignalCooldown, setGlobalSignalCooldown, sendSignalDoc } from '../lib/db';

export async function sendSignal(fromUid, toUid, anonymous, profile, showToast) {
  try {
    const cooldown = await checkGlobalSignalCooldown(fromUid);
    if (!cooldown.canSend) {
      showToast(`You can send your next signal in ${cooldown.remaining} min`, 'error');
      return null;
    }
    const signalId = await sendSignalDoc(fromUid, toUid, anonymous, profile);
    await setGlobalSignalCooldown(fromUid);
    return signalId;
  } catch {
    showToast('Failed to send signal', 'error');
    return null;
  }
}
