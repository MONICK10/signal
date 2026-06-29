import { supabase } from './config';

export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function registerUser(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/verify-email` },
  });
  if (error) throw error;
  return data;
}

export async function resendVerificationEmail() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.auth.resend({ type: 'signup', email: user.email });
}

export async function reloadUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function changePassword(currentPassword, newPassword) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (authError) {
    const e = new Error('Wrong password'); e.code = 'auth/wrong-password'; throw e;
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function deleteAccount() {
  // Full deletion needs a server-side Edge Function; sign out for now
  await supabase.auth.signOut();
}

// Legacy shape — a few components check auth.currentUser
export const auth = { get currentUser() { return null; } };
