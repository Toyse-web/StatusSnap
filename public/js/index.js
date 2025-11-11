document.addEventListener("DOMContentLoaded", () => {
    const messages = [
        "Welcome to StatusSnap",
        "Powerful WhatsApp Status Tools",
        "Ready to Optimize Your Status? We got your back!!"
    ];

    const textElement = document.getElementById("welcomeText");
    const cursor = document.getElementById("cursor");
    const intro = document.getElementById("introScreen");
    const main = document.getElementById("mainContent");

    let messageIndex = 0;
    let charIndex = 0;

    const typingSpeed = 70; //ms per character
    const pauseBetween = 100 // pause before deleting or next message

    function typeMessage() {
    if (charIndex < messages[messageIndex].length) {
      textElement.textContent += messages[messageIndex].charAt(charIndex);
      charIndex++;
      setTimeout(typeMessage, typingSpeed);
    } else {
      // pause, then move to next message
      setTimeout(() => {
        textElement.textContent = "";
        charIndex = 0;
        messageIndex++;
        if (messageIndex < messages.length) {
          typeMessage();
        } else {
          // finished all messages — show main
          cursor.style.display = "none";
          intro.style.opacity = "0";
          setTimeout(() => {
            intro.style.display = "none";
            main.classList.remove("hidden");
          }, 1000);
        }
      }, pauseBetween);
    }
  }

  typeMessage();
});