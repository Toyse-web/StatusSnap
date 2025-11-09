const form = document.getElementById('uploadForm');
const processBtn =document.getElementById("processBtn");
const progressContainer = document.getElementById("progressContainer");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const statusMessage = document.getElementById("statusMessage");
const videoInput = document.getElementById("videoInput");

// Hidden inputs for cloudinary trimming
const trimStartInput = document.getElementById("trimStart");
const trimEndInput = document.getElementById("trimEnd");

if (processBtn) processBtn.type = "button";

let progressInterval;

form.addEventListener("submit", function(e) {
  e.preventDefault();

  const videoFile = videoInput.files[0];
  if (!videoFile) {
    alert("Please select a video first!");
    return;
  }

  processBtn.classList.add("hidden");
  progressContainer.classList.remove("hidden");
  statusMessage.textContent = "Uploading and trimming...";

  // Start visual progress (simulate until backend respons)
  let progress = 0;
  progressInterval = setInterval(() => {
    progress += Math.random() * 5;
    if (progress >= 95) progress = 95;
    updateProgress(progress);
  }, 500);
})

function updateProgress(percent) {
  progressFill.style.width = percent + "%";
  progressText.textContent = Math.round(percent) + "%";

  // Update status message based on progress
  if (percent < 25) {
    statusMessage.textContent = "Analyzing video...";
  } else if (percent < 50) {
    statusMessage.textContent = "Processing video...";
  } else if (percent < 75) {
    statusMessage.textContent = "Optimizing for WhatsApp...";
  } else {
    statusMessage.textContent = "Finalizing...";
  }
}

async function downloadAndShare(downloadUrl, filename) {
  const downloadBtn = event.target;
  const originalText = downloadBtn.textContent;
  try {
    // Show loading state
    downloadBtn.textContent = "Downloading...";
    downloadBtn.disabled = true;
    
    // Download the file
    const response = await fetch(downloadUrl);
    const blob = await response.blob();
    const file = new File([blob], filename, {type: "video/mp4"});
    
    // Create object UR
    const fileUrl = URL.createObjectURL(blob);
    
    // Try native sharing first (mobile devices)
    if (navigator.share) {
      try {
        await navigator.share({
          files: [file],
          title: "WhatsApp Status Video",
          text: "Check out my optimized video from statusSnap!"
        });
        console.log("File shared successfully");
        return;
      } catch (shareErr) {
        console.log("Native share failed, trying WhatsApp direct...");
      }
    }

            // Fallback direct Whatsapp share
            await shareToWhatsApp(file, fileUrl, filename);
         } catch (error) {
            console.error("Download and share error:", error);
            alert("Error sharing video. Please download and share manually.");
         } finally {
            // Reset button
            downloadBtn.textContent = originalText;
            downloadBtn.disabled = false;
         }
        }

        async function shareToWhatsApp(file, fileUrl, filename) {
            // For mobile devices
            if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                // Mobile Whatsapp share
                const whatsappUrl = `whatsapp://send?text=Check out my status video!`;
                window.location.href = whatsappUrl;

                // If whatsapp doesn't open, suggest manual share
                setTimeout(() => {
                    if (!document.hidden) {
                        alert("Whatsapp not detected. Please share the downloaded video manually from your gallery.");
                    }
                }, 3000);
            } else {
                // For desktop, we can't share files directly to Whatsapp web.
                // Provide instructions
                alert("For desktop: Please download the video first, then upload it to WhatsApp Web manually.\n\nThe video has been downloaded to your device.");

                // Trigger download
                const a = document.createElement("a");
                a.href = fileUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            // Clean up object URL
            setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
        }

        // Alt method for mobile devices
        function shareViaDownload(downloadUrl, filename) {
            // First, download the file
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Then try to open whatsApp
            if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                // Give a moment for download to complete
                setTimeout(() => {
                    const whatsappUrl = `whatsapp://`;
                    window.location.href = whatsappUrl;

                    // Instructions if whatsApp doesn't open
                    setTimeout(() => {
                         if (!document.hidden) {
                            alert('Video downloaded! Please open WhatsApp manually and upload the video from your gallery.');
                         }
                    }, 2000);
                }, 1000);
            } else {
                alert('Video downloaded! Please upload it to WhatsApp Web manually.');
            }
        }

        // Reset form page loads
        window.addEventListener("load", function() {
             processBtn.classList.remove('hidden');
            progressContainer.classList.add('hidden');
            statusMessage.textContent = '';
            if (progressInterval) {
                clearInterval(progressInterval);
            }
        });

// Video Trimmer Helper
// --- Trimmer improved: constrained playback + live scrub (pointer events) ---
const video = document.getElementById('videoPlayer');
const canvas = document.getElementById('thumbnailTrack');
const ctx = canvas.getContext('2d');
const track = document.getElementById('trimmerTrack');
const selectionOverlay = document.getElementById('selectionOverlay');
const startHandle = document.getElementById('startHandle');
const endHandle = document.getElementById('endHandle');
const playhead = document.getElementById('playhead');
const startTimeDisplay = document.getElementById('startTime');
const endTimeDisplay = document.getElementById('endTime');

let duration = 0;
let startPercent = 0;   // 0..1
let endPercent = 1;     // 0..1
let playheadPercent = 0;
let dragging = null;    // "start" | "end" | "playhead" | null
let framesReady = false;

// ensure track width is measured fresh
function trackWidth() { return Math.max(1, track.clientWidth); }

// ---------- File selection ----------
videoInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  video.src = url;
  video.load();
  video.style.display = 'block';
});

// ---------- When metadata loads ----------
video.addEventListener('loadedmetadata', async () => {
  duration = video.duration || 0.0001;
  // limit default selection to max 90s
  if (duration > 90) {
    endPercent = 90 / duration;
  } else {
    endPercent = 1;
  }
  startPercent = 0;
  playheadPercent = startPercent;
  await drawThumbnails(); // fills canvas
  updateOverlay();
  updateTimeDisplays();
  framesReady = true;
});

// ---------- Draw thumbnail frames for timeline ----------
async function drawThumbnails() {
  const w = trackWidth();
  const h = track.clientHeight;
  canvas.width = w;
  canvas.height = h;
  const frames = Math.min(12, Math.max(6, Math.floor(w / 60))); // responsive frames
  const step = duration / frames;
  video.pause();
  for (let i = 0; i < frames; ++i) {
    await seekTo(Math.min(i * step, duration - 0.05));
    ctx.drawImage(video, (i * w) / frames, 0, w / frames, h);
  }
  video.currentTime = Math.max(0, startPercent * duration);
}

function seekTo(t) {
  return new Promise(res => {
    const handler = () => {
      video.removeEventListener('seeked', handler);
      // small timeout to ensure frame drawn reliably on some devices
      setTimeout(res, 10);
    };
    video.addEventListener('seeked', handler);
    video.currentTime = Math.min(t, Math.max(0, duration - 0.05));
  });
}

// ---------- Pointer handling for handles + playhead ----------
function percentFromPointer(clientX) {
  const rect = track.getBoundingClientRect();
  const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
  return x / rect.width;
}

function startDrag(e) {
  e.preventDefault();
  e.stopPropagation();
  const target = e.target;

  if (target === startHandle) dragging = "start";
  else if (target === endHandle) dragging = "end";
  else if (target === playhead) dragging = "playhead";

  target.setPointerCapture?.(e.pointerId);
  document.body.style.touchAction = "none"; // Prevent scrolling while dragging
}

function moveDrag(e) {
  if (!dragging) return;
  const pct = percentFromPointer(e.clientX);
  const selLen = endPercent - startPercent;

    if (dragging === 'start') {
    startPercent = Math.min(pct, endPercent - 0.01);
    if ((endPercent - startPercent) * duration > 90) startPercent = endPercent - 90 / duration;
    playheadPercent = startPercent;
    video.currentTime = startPercent * duration;
  } else if (dragging === 'end') {
    endPercent = Math.max(pct, startPercent + 0.01);
    if ((endPercent - startPercent) * duration > 90) endPercent = startPercent + 90 / duration;
    if (playheadPercent > endPercent) playheadPercent = endPercent;
    video.currentTime = endPercent * duration;
  } else if (dragging === 'playhead') {
    playheadPercent = Math.min(Math.max(pct, startPercent), endPercent);
    video.pause();
    video.currentTime = playheadPercent * duration;
  }

    updateOverlay();
  updateTimeDisplays();
}

function stopDrag(e) {
  dragging = null;
  document.body.style.touchAction = 'auto';
}


// attach all
[startHandle, endHandle, playhead].forEach(el => {
  el.addEventListener('pointerdown', startDrag);
});
document.addEventListener('pointermove', moveDrag);
document.addEventListener('pointerup', stopDrag);
document.addEventListener('pointercancel', stopDrag);

function pointerDownHandler(e) {
  e.preventDefault();
  const target = e.target;
  if (target === startHandle) dragging = 'start';
  else if (target === endHandle) dragging = 'end';
  else if (target === playhead) dragging = 'playhead';
  // capture pointer for touch/mouse
  if (e.pointerId != null) target.setPointerCapture(e.pointerId);
}

function pointerMoveHandler(e) {
    if (!dragging) return;
    const pct = percentFromPointer(e.clientX);

    if (dragging === "start") {
        startPercent = Math.min(pct, endPercent - 0.01);

        // Ensure max 90 seconds
        if ((endPercent - startPercent) * duration > 90) {
            startPercent = endPercent - 90 / duration;
        }

        // Always kepp playhead at start (anchor behaviour)
        playheadPercent = startPercent;

        // Show perview at start position for feedback
        video.currentTime = startPercent * duration;
    }  else if (dragging === 'end') {
    endPercent = Math.max(pct, startPercent + 0.01);

    // Enforce 90s max
    if ((endPercent - startPercent) * duration > 90) {
      endPercent = startPercent + 90 / duration;
    }

    // If playhead accidentally goes beyond new end, bring it back to start
    if (playheadPercent > endPercent) {
      playheadPercent = startPercent;
      video.currentTime = startPercent * duration;
    }
  } else if (dragging === 'playhead') {
    playheadPercent = Math.min(Math.max(pct, startPercent), endPercent);

    if (!video.paused) video.pause();

    clearTimeout(window._scrubTimeout);
    window._scrubTimeout = setTimeout(() => {
      video.currentTime = playheadPercent * duration;
    }, 30);
  }

  updateOverlay();
  updateTimeDisplays();
}

function pointerUpHandler(e) {
  // release pointer capture if present
  try {
    if (e.pointerId != null && e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId);
  } catch (err) {}
  dragging = null;
}

// attach pointer events
[startHandle, endHandle, playhead].forEach(el => {
  el.addEventListener('pointerdown', pointerDownHandler);
});
document.addEventListener('pointermove', pointerMoveHandler);
document.addEventListener('pointerup', pointerUpHandler);
window.addEventListener('resize', () => {
  if (framesReady) drawThumbnails().then(updateOverlay);
});

// Handle live dragging on the playhead
let draggingPlayhead = false;

// pointerdown on playhead
playhead.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  draggingPlayhead = true;
  // Capture pointer so we can drag smoothly even if cursor leaves
  if (e.pointerId != null && track.setPointerCapture) {
    try { track.setPointerCapture(e.pointerId); } catch {}
  }
});

// pointermove while dragging
track.addEventListener('pointermove', (e) => {
  if (!draggingPlayhead) return;

  const rect = track.getBoundingClientRect();
  const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
  let pct = x / rect.width;

  // constrain inside selection
  pct = Math.min(Math.max(pct, startPercent), endPercent);
  playheadPercent = pct;

  // pause and show live preview as you drag
  if (!video.paused) video.pause();

  clearTimeout(window._scrubTimeout);
  window._scrubTimeout = setTimeout(() => {
    video.currentTime = playheadPercent * duration;
  }, 20);

  updateOverlay();
});

// pointerup → stop dragging
document.addEventListener('pointerup', (e) => {
  if (!draggingPlayhead) return;
  draggingPlayhead = false;
  if (e.pointerId != null && track.releasePointerCapture) {
    try { track.releasePointerCapture(e.pointerId); } catch {}
  }
  // final seek confirmation
  video.currentTime = playheadPercent * duration;
});

// ---------- Play behavior: play only inside selection ----------
video.addEventListener('play', () => {
  const selStart = startPercent * duration;
  const selEnd = endPercent * duration;

  // If user hits play but playhead is past the end, reset to start
  if (video.currentTime >= selEnd - 0.05) {
    video.currentTime = selStart;
  }
});

video.addEventListener('timeupdate', () => {
  const selStart = startPercent * duration;
  const selEnd = endPercent * duration;

  // keep playhead synced with currentTime
  playheadPercent = video.currentTime / duration;

  // if passed end -> pause and auto-return to start (like WhatsApp)
  if (video.currentTime >= selEnd - 0.05 && !video.paused) {
    video.pause();

    // Smooth slide back animation for visual polish
    const w = track.clientWidth;
    const playheadEl = playhead;
    playheadEl.style.transition = 'left 0.25s ease-out';
    playheadPercent = startPercent;
    video.currentTime = selStart;
    updateOverlay();

    // Remove transition after animation so dragging stays instant
    setTimeout(() => {
      playheadEl.style.transition = '';
    }, 300);
  }

  updateOverlay();
});

// UI update helpers 
function updateOverlay() {
  const w = trackWidth();
  selectionOverlay.style.left = (startPercent * w) + 'px';
  selectionOverlay.style.width = ((endPercent - startPercent) * w) + 'px';
  // position handles slightly offset so handle center is aligned
  startHandle.style.left = (startPercent * w - startHandle.offsetWidth / 2) + 'px';
  endHandle.style.left = (endPercent * w - endHandle.offsetWidth / 2) + 'px';
  playhead.style.left = (playheadPercent * w - playhead.offsetWidth / 2) + 'px';
}

function updateTimeDisplays() {
  const s = startPercent * duration;
  const e = endPercent * duration;
  startTimeDisplay.textContent = formatTime(s);
  endTimeDisplay.textContent = formatTime(e);
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '00:00';
  const mm = Math.floor(sec / 60).toString().padStart(2, '0');
  const ss = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

// Make sure process button is a plain button (defensive)
if (processBtn) processBtn.type = 'button';

// Remove any form submit handler if still bound earlier. If you previously added one, you can
// optionally do form.onsubmit = null; to clear it here. (But changing the button to type="button" is enough.)

processBtn.addEventListener("click", (e) => {
  e.preventDefault();

  const file = videoInput.files[0];
  if (!file) {
    alert("Please select a video first!");
    return;
  }

  // Ensure trim values are set from your trimmer state
  // NOTE: startPercent/endPercent/duration must be up-to-date from your trimmer code
  const startSeconds = (typeof startPercent !== 'undefined' && typeof duration !== 'undefined')
    ? (startPercent * duration)
    : 0;
  const endSeconds = (typeof endPercent !== 'undefined' && typeof duration !== 'undefined')
    ? (endPercent * duration)
    : Math.min(90, duration || 90);

  trimStartInput.value = startSeconds.toFixed(2);
  trimEndInput.value = endSeconds.toFixed(2);

  // Show progress UI
  progressContainer.classList.remove("hidden");
  progressFill.style.width = "0%";
  progressText.textContent = "0%";
  statusMessage.textContent = "Uploading...";

  // Prepare form data (same fields your backend expects)
  const fd = new FormData(form); // contains file + hidden start/end

  // Use XHR so we can read upload progress
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/process-video", true);

  // Upload progress
  xhr.upload.onprogress = (evt) => {
    if (evt.lengthComputable) {
      const percent = (evt.loaded / evt.total) * 80; // allocate 80% to upload
      progressFill.style.width = `${percent.toFixed(1)}%`;
      progressText.textContent = `${Math.floor(percent)}%`;
      statusMessage.textContent = "Uploading to server...";
    }
  };

  // If server sends long processing time after receiving upload, show simulated processing progress up to 95%
  let processingInterval = null;
  xhr.onloadstart = () => {
    // nothing
  };

  xhr.onload = () => {
    // upload finished (server responded). Clear any processing interval
    if (processingInterval) {
      clearInterval(processingInterval);
      processingInterval = null;
    }

    if (xhr.status >= 200 && xhr.status < 300) {
      // Server returned HTML (your res.render("index", ...))
      const html = xhr.responseText;

      // Show almost-done then inject html
      progressFill.style.width = "100%";
      progressText.textContent = "100%";
      statusMessage.textContent = "Done!";

      // Replace container contents so the download/share buttons (rendered by server) appear
      const container = document.querySelector('.container');
      if (container) {
        container.innerHTML = html;
      } else {
        // fallback: write whole document (less preferred)
        document.open();
        document.write(html);
        document.close();
      }

      // Optional: scroll to actions
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 200);
    } else {
      // server returned error
      console.error("Upload error, server status:", xhr.status, xhr.responseText);
      statusMessage.textContent = "Server error: " + xhr.status;
      alert("Upload failed. See console for details.");
      // hide progress or let user retry
    }
  };

  xhr.onerror = () => {
    if (processingInterval) { clearInterval(processingInterval); processingInterval = null; }
    console.error("Network error uploading file");
    statusMessage.textContent = "Network error during upload";
    alert("Network error during upload. Try again.");
  };

  // In case server receives the file and does longer work, we can simulate remaining progress up to 95%
  xhr.onreadystatechange = () => {
    // When upload is done and readyState is 2/3 (headers/processing) we can start a small simulated progress
    // but avoid double-starting:
    if (xhr.readyState === 2) {
      let current = parseFloat(progressFill.style.width) || 0;
      if (!processingInterval) {
        processingInterval = setInterval(() => {
          current = Math.min(95, current + Math.random() * 3);
          progressFill.style.width = `${current}%`;
          progressText.textContent = `${Math.floor(current)}%`;
          statusMessage.textContent = "Server processing...";
        }, 400);
      }
    }
  };

  // send it
  xhr.send(fd);
});
