import { supabase } from './config';

export async function callSendVibeRequest({ toUserId }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.rpc('send_vibe_request', {
    p_from_uid: user.id,
    p_to_uid: toUserId,
  });
  if (error) throw error;
  return { data: { requestId: data } };
}

export async function callRespondToVibeRequest({ requestId, accept }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.rpc('respond_to_vibe_request', {
    p_request_id: requestId,
    p_responder_uid: user.id,
    p_accept: accept,
  });
  if (error) throw error;
  return { data };
}
