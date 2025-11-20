self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  
  event.waitUntil(
    self.registration.showNotification(data.title || "Reminder", {
        body: data.body || "It's time to post!",
        icon: "/img/whatsapp.png",
        data
    })
);
});

self.addEventListener("notificationclick", e => {
    e.notification.close();
    const caption = e.notification.data.caption || "";
    e.waitUntil(
        clients.openWindow(`https://wa.me/?text=${encodeURIComponent(caption)}`)
    );
});