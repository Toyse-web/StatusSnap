// Request notification permission
if (Notification.permission !== "granted") {
    Notification.requestPermission();
}

// When scheduled time arrives
function scheduleNotify(caption, time) {
    const delay = new Date(time) - new Date();
    if (delay > 0) {
        setTimeout(() => {
            new Notification("Time to Post!", {
            body: caption,
            icon: "/img/whatsapp.png"
        });
        }, delay);
    }
}

function openWhatsApp(text) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}
