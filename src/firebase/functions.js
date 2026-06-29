import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './config';

const fns = getFunctions(app);

export const callSendVibeRequest = httpsCallable(fns, 'sendVibeRequest');
export const callRespondToVibeRequest = httpsCallable(fns, 'respondToVibeRequest');
