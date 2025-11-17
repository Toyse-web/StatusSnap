const statusType = document.getElementById("statusType");
const textSection = document.getElementById("textSection");
const imageSection = document.getElementById("imageSection");
const videoSection = document.getElementById("videoSection");

// Get all caption fields
const textCaption = textSection.querySelector("textarea[name='caption']");
const imageCaption = imageSection.querySelector("textarea[name='caption']");
const videoCaption = videoSection.querySelector("textarea[name='caption']");

function updateFormVisibility() {
    const type = statusType.value;

    // Hide all first
    textSection.classList.add("hidden");
    imageSection.classList.add("hidden");
    videoSection.classList.add("hidden");

    // Disable required on all captions
    textCaption.removeAttribute("required");
    imageCaption.removeAttribute("required");
    videoCaption.removeAttribute("required");

    // Show and enable required only for the active type
    if (type === "text") {
      textSection.classList.remove("hidden");
      textCaption.setAttribute("required", "");
    } else if (type === "image") {
      imageSection.classList.remove("hidden");
      imageCaption.setAttribute("required", "");
    } else if (type === "video") {
      videoSection.classList.remove("hidden");
      videoCaption.setAttribute("required", "");
    }
}

updateFormVisibility();

// Request Notification Permission
if (Notification.permission !== "granted") {
  Notification.requestPermission();
}

// Subscribe to Push Notifications
async function subscribeUser() {
  const registration = await navigator.serviceWorker.ready;
  const response = await fetch("/vapidPublicKey");
  const vapidPublicKey = await response.text();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });

  await fetch("/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription),
    headers: {"Content-Type": "application/json"},
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++)
    outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
subscribeUser();

// Change UI depending on selected type
statusType.addEventListener("change", updateFormVisibility);