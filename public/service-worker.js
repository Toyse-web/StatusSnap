self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Reminder";
  const options = {
    body: data.body || "It's time to post your WhatsApp status!",
    icon: "/img/whatsapp.png",
    data: data.data || {}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("push", event => {
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: "/img/whatsapp.png",
            data: data.data
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