self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());

self.addEventListener("push", (event) => {
let data = {};

try {
    data = event.data.json();
} catch (e) {
    console.error("Push data error:", e);
}

const title = data.title || "Scheduled Alert";
const body = data.body || "You have a reminder";
  
event.waitUntil(
self.registration.showNotification(title, {
    body,
    icon: "/img/whatsapp.png",
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