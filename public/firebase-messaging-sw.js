importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB4m83IWWSlRhDH2KxiCaICVcYezi52M-g',
  authDomain: 'signal-app-2f5e6.firebaseapp.com',
  projectId: 'signal-app-2f5e6',
  storageBucket: 'signal-app-2f5e6.firebasestorage.app',
  messagingSenderId: '1050147309177',
  appId: '1:1050147309177:web:d0cf35deb9dc771257b6a8',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/vite.svg',
    badge: '/vite.svg',
    data: payload.data,
  });
});

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
