import { checkSignalCooldown, setSignalCooldown, sendSignalDoc } from '../firebase/firestore';

export async function sendSignal(fromUid, toUid, anonymous, profile, showToast) {
  try {
    const cooldown = await checkSignalCooldown(fromUid, toUid);
    if (!cooldown.canSend) {
      showToast(`Signal again in ${cooldown.remaining} min`, 'error');
      return null;
    }
    const signalId = await sendSignalDoc(fromUid, toUid, anonymous, profile);
    await setSignalCooldown(fromUid, toUid);
    return signalId;
  } catch {
    showToast('Failed to send signal', 'error');
    return null;
  }
}
