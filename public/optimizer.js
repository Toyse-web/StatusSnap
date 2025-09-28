class WhatsAppStatusOptimizer {
    constructor() {
        this.videoInput = document.getElementById("videoInput");
        this.uploadArea = document.getElementById("uploadArea");
        this.previewContainer = document.getElementById("previewContainer");
        this.videoPreview = document.getElementById("videoPreview");
        this.optimizeBtn = document.getElementById("optimizeBtn");
        this.result = document.getElementById("result");
        this.downloadLink = document.getElementById("downloadLink");

        // Trimmer elements
        this.videoTrimmer = document.getElementById("videoTrimmer");
        this.timelineContainer = document.getElementById("timelineContainer");
        this.selectionArea = document.getElementById("selectionArea");
        this.handleLeft = document.getElementById("handleLeft");
        this.handleRight = document.getElementById("handleRight");
        this.startTimeElement = document.getElementById("startTime");
        this.endTimeElement = document.getElementById("endTime");
        this.durationElement = document.getElementById("duration");
        this.totalStartTime = document.getElementById("totalStartTime");
        this.totalEndTime = document.getElementById("totalEndTime");
        this.playSegmentBtn = document.getElementById("playSegment");
        this.resetSelectionBtn = document.getElementById("resetSelection");
        this.previewTime = document.getElementById("previewTime"); 
        this.processingStatus = document.getElementById("processingStatus");
        this.progressBar = document.getElementById("progressBar");
        this.progressText = document.getElementById("progressText");


        this.init();
    }

    init() {
        this.uploadArea.addEventListener("click", () => this.videoInput.click());
        this.uploadArea.addEventListener("dragover", (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener("drop", (e) => this.handleDrop(e));
        this.videoInput.addEventListener("change", (e) => this.handleFileSelect(e));
        this.optimizeBtn.addEventListener("click", () => this.optimizeVideo());
        this.playSegmentBtn.addEventListener("click", () => this.playSelectedSegment());
        this.resetSelectionBtn.addEventListener("click", () => this.resetSelection());
        
        this.setupTrimmerEvents();

        // Video event listeners
        this.videoPreview.addEventListener("loadedmetadata", () => this.initializeTrimmer());
        this.videoPreview.addEventListener("timeupdate", () => this.updatePlayhead());
    }

    setupTrimmerEvents() {
        let isDragging = false;
        let dragTarget = null;
        let startX = 0;
        let selectionStart = 0;

        const handleMouseDown = (e, target) => {
            e.preventDefault();
            isDragging = true;
            dragTarget = target;
            startX = e.clientX;
            selectionStart = parseFloat(this.selectionArea.style.left || "0");

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const rect = this.timelineContainer.getBoundingClientRect();
            const deltaX = e.clientX - startX;
            const deltaPercent = (deltaX / rect.width) * 100;

            this.handleDrag(dragTarget, deltaPercent, selectionStart);
        };

        const handleMouseUp = () => {
            isDragging = false;
            dragTarget = null;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };

        // Event listeners for handles
        this.handleLeft.addEventListener("mousedown", (e) => handleMouseDown(e, "left"));
        this.handleRight.addEventListener("mousedown", (e) => handleMouseDown(e, "right"));
        this.selectionArea.addEventListener("mousedown", (e) => handleMouseDown(e, "area"));

        // Timeline click to move selection
        this.timelineContainer.addEventListener("click", (e) => {
            const rect = this.timelineContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickPercent = (clickX / rect.width) * 100;

            this.moveSelectionTo(clickPercent);
        });
    }

    handleDrag(target, deltaPercent, selectionStart) {
        const currentLeft = parseFloat(this.selectionArea.style.left || "0");
        const currentWidth = parseFloat(this.selectionArea.style.width || "30"); //Default 30% width

        let newLeft = currentLeft;
        let newWidth = currentWidth;

        switch (target) {
            case "left":
                newLeft = Math.max(0, selectionStart + deltaPercent);
                newWidth = Math.max(5, currentWidth - deltaPercent);
                break;
            case "right":
                newWidth = Math.max(5, currentWidth + deltaPercent);
                break;
            case "area":
                newLeft = Math.max(0, Math.min(100 - newWidth, selectionStart + deltaPercent));
                break;
        }

        // Ensure selection stays within bounds
        if (newLeft + newWidth > 100) {
            if (target === "area") {
                newLeft = 100 - newWidth;
            } else {
                newWidth = 100 - newLeft;
            }
        }

        this.updateSelection(newLeft, newWidth);
    }

    moveSelectionTo(clickPercent) {
        const currentWidth = parseFloat(this.selectionArea.style.width || "30");
        let newLeft = clickPercent - (currentWidth / 2);

        // Keep within bounds
        newLeft = Math.max(0, Math.min(100 - currentWidth, newLeft));
        this.updateSelection(newLeft, currentWidth);
    }

    updateSelection(left, width) {
        this.selectionArea.style.left = left + "%";
        this.selectionArea.style.width = width + "%";
        this.updateTimeDisplay();
    }

    initializeTrimmer() {
        const duration = this.videoPreview.duration;
        this.videoTrimmer.style.display = "block";

        // Format total duration
        this.totalStartTime.textContent = this.formatTime(0);
        this.totalEndTime.textContent = this.formatTime(duration);

        // Set initial selection (first 90 seconds or full video if shorter)
        const maxSelectionDuration = 90; //WhatsApp's 90-seconds limit
        const selectionDuration = Math.min(maxSelectionDuration, duration);
        const selectionWidth = (selectionDuration / duration) * 100;

        this.updateSelection(0, selectionWidth);
    }

    updateTimeDisplay() {
        const duration = this.videoPreview.duration;
        const left = parseFloat(this.selectionArea.style.left || "0");
        const width = parseFloat(this.selectionArea.style.width || "30");

        const startTime = (left / 100) * duration;
        const endTime = ((left + width) / 100) * duration;
        const selectedDuration = endTime - startTime;

        this.startTimeElement.textContent = this.formatTime(startTime);
        this.endTimeElement.textContent = this.formatTime(endTime);
        this.durationElement.textContent = selectedDuration.toFixed(1);

        // Highlight if selection is too long
        if (selectedDuration > 90) {
            this.previewTime.style.color = "#e74c3c";
        } else {
            this.previewTime.style.color = "#2ecc71";
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    updatePlayhead() {
        // This would update a playhead position on the timeline
        // Implementation can be added later
    }

    playSelectedSegment() {
        const duration = this.videoPreview.duration;
        const left = parseFloat(this.selectionArea.style.left || "0");
        const startTime = (left / 100) * duration;

        this.videoPreview.currentTime = startTime;
        this.videoPreview.play();

        // Stop at the end of selection
        const width = parseFloat(this.selectionArea.style.width || "30");
        const endTime = ((left + width) / 100) * duration;

        const stopAtEnd = () => {
            if (this.videoPreview.currentTime >= endTime) {
                this.videoPreview.pause();
                this.videoPreview.removeEventListener("timeupdate", stopAtEnd);
            }
        };

        this.videoPreview.addEventListener("timeupdate", stopAtEnd);
    }

    resetSelection() {
        const duration = this.videoPreview.duration;
        const maxSelectionDuration = 90;
        const selectionDuration = Math.min(maxSelectionDuration, duration);
        const selectionWidth = (selectionDuration / duration) * 100;

        this.updateSelection(0, selectionWidth);
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.style.borderColor = "#25D366";
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.style.borderColor = "#ccc";
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processVideoFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processVideoFile(file);
        }
    }

    processVideoFile(file) {
        if (!file.type.startsWith("video/")) {
            alert("Please select a video file");
            return;
        }

        this.originalFile = file;
        this.videoPreview.src = URL.createObjectURL(file);
        this.previewContainer.style.display = "block";
        this.result.style.display = "none";
    }

    async optimizeVideo() {
    if (!this.originalFile) return;

    this.optimizeBtn.textContent = "Optimizing...";
    this.optimizeBtn.disabled = true;
    
    if (this.processingStatus) {
        this.processingStatus.style.display = "block";
    }
    this.updateProgress(10, "Preparing video...");

    try {
        const quality = document.querySelector('input[name="quality"]:checked').value;

        // Get trim times
        const duration = this.videoPreview.duration;
        const left = parseFloat(this.selectionArea.style.left || "0");
        const width = parseFloat(this.selectionArea.style.width || "30");
        let startTime = (left / 100) * duration;
        let endTime = ((left + width) / 100) * duration;

        // Validate times
        if (!isFinite(startTime) || !isFinite(endTime)) {
            throw new Error("Invalid time selection");
        }

        startTime = Math.max(0, startTime);
        endTime = Math.min(duration, endTime);

        if (endTime - startTime > 90) {
            endTime = startTime + 90;
        }

        this.updateProgress(30, "Uploading to server...");

        // USE SERVER PROCESSING - this is the key fix!
        const optimizedBlob = await this.processOnServer(this.originalFile, quality, startTime, endTime);

        this.updateProgress(90, "Finalizing...");

        // Create download link
        const url = URL.createObjectURL(optimizedBlob);
        this.downloadLink.href = url;

        this.updateProgress(100, "Ready! Crystal clear with audio! 🎬🔊");

        setTimeout(() => {
            this.result.style.display = "block";
            this.previewContainer.style.display = "none";
            if (this.processingStatus) {
                this.processingStatus.style.display = "none";
            }
        }, 1000);
        
    } catch (error) {
        console.error("Optimization failed:", error);
        
        // If server fails, show specific message
        if (error.message.includes("server") || error.message.includes("Server")) {
            alert("Server processing failed. Please ensure FFmpeg is installed on your server. Error: " + error.message);
        } else {
            alert("Video optimization failed: " + error.message);
        }
        
        if (this.processingStatus) {
            this.processingStatus.style.display = "none";
        }
    }

    this.optimizeBtn.textContent = "Optimize Video";
    this.optimizeBtn.disabled = false;
}

async processVideoWithAudio(video, quality, startTime, endTime, audioContext) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Preserve original quality - don't downscale unless necessary
        let width = video.videoWidth;
        let height = video.videoHeight;

        // Only resize if larger than WhatsApp's limits
        const maxWidth = 1080;
        const maxHeight = 1920;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
            
            // Ensure even dimensions for codec compatibility
            width = width % 2 === 0 ? width : width - 1;
            height = height % 2 === 0 ? height : height - 1;
        }

        canvas.width = width;
        canvas.height = height;

        // Higher quality settings
        const qualitySettings = {
            high: { 
                bitrate: 5000000, 
                frameRate: 30,
                audioBitrate: 192000
            },
            balanced: { 
                bitrate: 2500000, 
                frameRate: 30,
                audioBitrate: 128000
            },
            small: { 
                bitrate: 1500000, 
                frameRate: 24,
                audioBitrate: 96000
            }
        };

        const settings = qualitySettings[quality];
        const mimeType = this.getSupportedMimeType();

        try {
            // Create audio stream
            const audioDestination = audioContext.createMediaStreamDestination();
            const audioSource = audioContext.createMediaElementSource(video);
            audioSource.connect(audioDestination);
            audioSource.connect(audioContext.destination); // Keep audio playing

            // Create video stream from canvas
            const videoStream = canvas.captureStream(settings.frameRate);
            
            // Combine audio and video streams
            const combinedStream = new MediaStream([
                ...videoStream.getVideoTracks(),
                ...audioDestination.stream.getAudioTracks()
            ]);

            const recorder = new MediaRecorder(combinedStream, {
                mimeType: mimeType,
                videoBitsPerSecond: settings.bitrate,
                audioBitsPerSecond: settings.audioBitrate
            });

            const chunks = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType });
                this.validateVideoBlob(blob).then(() => resolve(blob)).catch(reject);
                
                // Cleanup
                combinedStream.getTracks().forEach(track => track.stop());
                audioSource.disconnect();
            };

            recorder.onerror = (e) => {
                reject(new Error("Recording error: " + e.error));
            };

            // Set start time and play
            video.currentTime = startTime;
            
            let isPlaying = false;
            let startTimestamp = 0;
            let expectedDuration = endTime - startTime;

            const drawFrame = (currentTime) => {
                if (!isPlaying) return;

                const elapsed = (currentTime - startTimestamp) / 1000;
                
                // Stop if we've reached the end time
                if (elapsed >= expectedDuration || video.currentTime >= endTime) {
                    recorder.stop();
                    video.pause();
                    return;
                }

                try {
                    // High-quality drawing with anti-aliasing
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    // Clear and draw with proper scaling
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    requestAnimationFrame(drawFrame);
                } catch (error) {
                    console.warn('Frame error:', error);
                    requestAnimationFrame(drawFrame);
                }
            };

            video.onplay = () => {
                isPlaying = true;
                startTimestamp = performance.now();
                recorder.start(1000); // Start recording
                requestAnimationFrame(drawFrame);
            };

            video.onpause = () => {
                isPlaying = false;
            };

            video.onended = () => {
                isPlaying = false;
                if (recorder.state === 'recording') {
                    recorder.stop();
                }
            };

            // Start playback
            video.play().catch(error => {
                reject(new Error("Could not play video: " + error.message));
            });

            // Safety timeout
            setTimeout(() => {
                if (recorder.state === 'recording') {
                    recorder.stop();
                    video.pause();
                }
            }, (expectedDuration * 1000) + 10000);

        } catch (error) {
            reject(new Error("Media setup failed: " + error.message));
        }
    });
}

     getSupportedMimeType() {
        const testTypes = [
        'video/mp4; codecs="avc1.640028, mp4a.40.2"', // High profile
        'video/mp4; codecs="avc1.42001E, mp4a.40.2"', // Baseline profile
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        'video/webm; codecs="vp9, opus"',
        'video/webm; codecs="vp8, opus"',
        'video/mp4',
        'video/webm'
    ];

        for (const type of testTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log("No optimal MIME type found, using default");
                return type;
            }
        }
        console.log("Using fallback MIME type: video/mp4");
        return "video/mp4"; //fallback
    }

    async processOnServer(file, quality, startTime, endTime) {
    this.updateProgress(40, "Uploading video to server...");

    const formData = new FormData();
    formData.append('video', file);
    formData.append('quality', quality);
    formData.append('startTime', startTime.toString());
    formData.append('endTime', endTime.toString());

    try {
        const response = await fetch("/api/optimize-video", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            // Try to get detailed error message from server
            let errorMessage = "Server processing failed";
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.details || errorMessage;
            } catch (e) {
                // If JSON parsing fails, use status text
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        this.updateProgress(80, "Server is processing your video...");
        const blob = await response.blob();

        // Validate the downloaded file
        if (blob.size === 0) {
            throw new Error("Server returned empty file");
        }

        console.log("Server processing successful. File size:", blob.size, "bytes");
        return blob;
    } catch (error) {
        console.error("Server processing error:", error);
        throw new Error("Server processing failed: " + error.message);
    }
}

async fallbackToClientProcessing(quality, startTime, endTime) {
    try {
        this.updateProgress(50, "Using client-side processing...");
        const optimizedBlob = await this.compressVideo(this.originalFile, quality, startTime, endTime);
        
        this.updateProgress(90, "Finalizing video...");
        const url = URL.createObjectURL(optimizedBlob);
        this.downloadLink.href = url;
        
        this.updateProgress(100, "Video ready!");
        
        setTimeout(() => {
            this.result.style.display = "block";
            this.previewContainer.style.display = "none";
            this.processingStatus.style.display = "none";
        }, 1000);
        
    } catch (error) {
        throw new Error("Client-side processing also failed: " + error.message);
    }
}

updateProgress(percent, text) {
    // Check if progress elements exist
    if (this.progressBar && this.progressText) {
        this.progressBar.style.width = percent + "%";
        this.progressText.textContent = text;
    }
    // log for debugging
    console.log(`Progress: ${percent}% - ${text}`);
}

async compressVideo(file, quality, startTime = 0, endTime = null) {
    return new Promise((resolve, reject) => {
        // Validate inputs
        if (!file) {
            reject(new Error("No file provided"));
            return;
        }

        if (!isFinite(startTime) || startTime < 0) {
            reject(new Error("Invalid start time: " + startTime));
            return;
        }

        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        video.src = URL.createObjectURL(file);
        
        video.addEventListener("error", (e) => {
            reject(new Error("Video loading error: " + e.message));
        });

        const loadTimeout = setTimeout(() => {
            reject(new Error("Video loading timeout"));
        }, 30000);

        video.onloadedmetadata = () => {
            clearTimeout(loadTimeout);
            
            // Validate video metadata
            if (!video.videoWidth || !video.videoHeight) {
                reject(new Error("Video dimensions could not be determined"));
                return;
            }

            const videoDuration = video.duration;
            
            // Set endTime if not provided
            if (endTime === null || !isFinite(endTime)) {
                endTime = videoDuration;
            }

            // Validate time values
            if (!isFinite(startTime) || !isFinite(endTime)) {
                reject(new Error("Invalid time values. Start: " + startTime + ", End: " + endTime));
                return;
            }

            // Ensure times are within bounds
            startTime = Math.max(0, Math.min(startTime, videoDuration));
            endTime = Math.max(0, Math.min(endTime, videoDuration));
            
            if (startTime >= endTime) {
                reject(new Error("Start time must be before end time"));
                return;
            }

            const segmentDuration = endTime - startTime;
            if (segmentDuration > 90) {
                reject(new Error("Video segment cannot exceed 90 seconds"));
                return;
            }

            if (segmentDuration <= 0) {
                reject(new Error("Video segment must have positive duration"));
                return;
            }
            
            const maxWidth = 1080;
            const maxHeight = 1920;

            let width = video.videoWidth;
            let height = video.videoHeight;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            }

            // Ensure even dimensions
            width = width % 2 === 0 ? width : width - 1;
            height = height % 2 === 0 ? height : height - 1;

            canvas.width = width;
            canvas.height = height;

            const qualitySettings = {
                high: { bitrate: 3000000, frameRate: 30 },
                balanced: { bitrate: 1500000, frameRate: 30 },
                small: { bitrate: 1000000, frameRate: 24 }
            };

            const settings = qualitySettings[quality] || qualitySettings.balanced;
            const mimeType = this.getSupportedMimeType();

            // Set start time with validation
            if (startTime > videoDuration) {
                reject(new Error("Start time exceeds video duration"));
                return;
            }

            video.currentTime = startTime;

            let stream;
            let recorder;

            try {
                stream = canvas.captureStream(settings.frameRate);
                recorder = new MediaRecorder(stream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: settings.bitrate
                });

                const chunks = [];
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    if (blob.size === 0) {
                        reject(new Error("Generated video is empty"));
                        return;
                    }
                    resolve(blob);
                };

                recorder.onerror = (e) => {
                    reject(new Error("MediaRecorder error: " + e.error));
                };

                recorder.start(1000);

                let playbackStarted = false;
                
                const startPlayback = () => {
                    if (playbackStarted) return;
                    playbackStarted = true;

                    video.play().catch(error => {
                        reject(new Error("Could not play video: " + error.message));
                    });
                };

                video.oncanplay = startPlayback;
                
                video.onplay = () => {
                    const drawFrame = () => {
                        if (video.paused || video.ended || video.currentTime >= endTime) {
                            if (recorder && recorder.state === 'recording') {
                                recorder.stop();
                                stream.getTracks().forEach(track => track.stop());
                            }
                            return;
                        }

                        try {
                            ctx.fillStyle = 'black';
                            ctx.fillRect(0, 0, width, height);
                            ctx.drawImage(video, 0, 0, width, height);
                            requestAnimationFrame(drawFrame);
                        } catch (error) {
                            console.warn("Frame error:", error);
                            requestAnimationFrame(drawFrame);
                        }
                    };

                    drawFrame();
                };

                // Start playback after a short delay to ensure everything is ready
                setTimeout(startPlayback, 100);

                // Safety timeout
                setTimeout(() => {
                    if (recorder && recorder.state === 'recording') {
                        recorder.stop();
                        stream.getTracks().forEach(track => track.stop());
                    }
                }, (segmentDuration * 1000) + 10000);

            } catch (error) {
                reject(new Error("Media setup failed: " + error.message));
            }
        };

        video.onerror = (e) => {
            clearTimeout(loadTimeout);
            reject(new Error("Video loading failed: " + e.message));
        };
    });
}

    async validateVideoBlob(blob) {
        return new Promise((resolve, reject) => {
            if (blob.size === 0) {
                reject(new Error("Generated video is empty"));
                return;
            }
            if (blob.size > 16 * 1024 * 1024) {// 16MB Whatsapp limit
                reject(new Error("Video file is too large for WhatsApp (max 16MB"));
                return;
            }

            const video = document.createElement("video");
            video.src = URL.createObjectURL(blob);

            video.onloadeddata = () => {
                URL.revokeObjectURL(video.src);
                if (video.duration > 0 && video.videoWidth > 0 && video.videoHeight > 0) {
                    resolve();
                } else {
                    reject(new Error("Generated video is invalid"));
                }
            };
            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                reject(new Error("Generated video cannot be played"));
            };

            // Timeout for validation
            setTimeout(() => {
                URL.revokeObjectURL(video.src);
                reject(new Error("Video validation timeout"));
            }, 10000);
        });
    }

    getSupportMimeType() {
        const types = [
            'video/mp4; codecs="avc1.42002A, mp4a.40.2"',
            'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
            'video/webm; codecs="vp9, opus"',
            'video/webm; codecs="vp8, vorbis"',
            'video/mp4',
            'video/webm'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return "video/mp4"; //Fallback
    }
}

// Initialize the optimizer when page loads
document.addEventListener('DOMContentLoaded', () => {
    new WhatsAppStatusOptimizer();
});