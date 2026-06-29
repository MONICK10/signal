// Notification click handler (push notifications not yet configured)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = '/';
  if (data.type === 'signal')        url = '/signals';
  if (data.type === 'chat')          url = `/chat/${data.chatId}`;
  if (data.type === 'friendRequest') url = '/profile';
  if (data.type === 'friendChat')    url = `/messages/${data.chatId}`;
  if (data.type === 'vibeRequest')   url = '/notifications';
  if (data.type === 'vibeResult')    url = '/notifications';
  event.waitUntil(clients.openWindow(url));
});
