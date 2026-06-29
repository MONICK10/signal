// Push notifications are not yet configured in the Supabase migration.
// This hook is a no-op stub so existing callers don't break.
export function usePushNotifications() {
  const requestPermission = async () => {};
  const onForegroundMessage = () => () => {};
  return { requestPermission, onForegroundMessage };
}
