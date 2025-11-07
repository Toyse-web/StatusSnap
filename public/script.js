
        const form = document.getElementById('uploadForm');
        const progress = document.getElementById('progress');
        const processBtn =document.getElementById("processBtn");
        const progressContainer = document.getElementById("progressContainer");
        const progressFill = document.getElementById("progressFill");
        const progressText = document.getElementById("progressText");
        const statusMessage = document.getElementById("statusMessage");
        const videoInput = document.getElementById("videoInput");

        let progressInterval;

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            if(!videoInput.files[0]) {
                alert("Please select a video file first!");
                return;
            }
            // Show progress bar, hide button
            processBtn.classList.add("hidden");
            progressContainer.classList.remove("hidden");
            statusMessage.textContent = "Processing...";

            let progress = 0;
            progressInterval = setInterval(() => {
                progress += Math.random() * 5;
                if (progress >= 95) {
                    progress = 95; //Hold at 95% until actual completion
                }
                updateProgress(progress);
            }, 500);

            // Actually submit the form
            this.submit();
        });

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

                // Create object URL
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