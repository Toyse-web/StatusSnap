require("dotenv").config();
const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;
const cloudinary = require("cloudinary").v2;

const bodyParser = require("body-parser");
const schedule = require("node-schedule");
const webpush = require("web-push");

// configure with env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
console.log("Using ffmpeg binary:", ffmpegInstaller.path);

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(express.json());
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({extended: true}));

// Ensure directories exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer setup (temporary upload location)
const upload = multer({
  dest: "/tmp/",
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// Push Notification Setup
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error("Missing VAPID keys. Generate and set VAPID_KEYS");
  process.exit(1);
}

webpush.setVapidDetails(
"mailto:olayonwatoyib5@gmail.com",
  vapidPublicKey,
  vapidPrivateKey
)

let subscriptions = [];
let posts = [];

// Serve VAPID public key to client
app.get("/vapidPublicKey", (req, res) => {
  res.send(vapidPublicKey);
});

// Persistence subscription to adapt to DB
const SUBS_FILE = path.join(__dirname, "data", "subscriptions.json");
if (!fs.existsSync(path.dirname(SUBS_FILE))) fs.mkdirSync(path.dirname(SUBS_FILE), {recursive: true});

function loadSubscription() {
  try {
    subscriptions = JSON.parse(fs.readFileSync(SUBS_FILE, "utf8"));
  } catch(e) {
    subscriptions = [];
  }
}

loadSubscription();

function saveSubscription(arr) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(arr, null, 2));
}

subscriptions = loadSubscription();

// Store push subscription from browser
app.post("/subscribe", (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({error: "Invalid subscription"});
  // Avoid duplicates
  if (!subscriptions.find(s => s.endpoint === sub.endpoint)) {
    subscriptions.push(sub);
    saveSubscription(subscriptions);
    console.log("New subscription saved:", sub.endpoint);
  }
  res.status(201).json({});
});

app.get("/test-push", async (req, res) => {
  if (!subscriptions.length) return res.status(200).send("No subscription  to push to.");
  try {
    await sendPushNotification({caption: "Test notification from server"})
    res.send("Push sent (or attempted). Check client.")
  } catch (err) {
    console.error("Test push error:", err);
    res.status(500).send("Error sending push.")
  }
});

// Store subscription when user subscribes
global.subscription = null;
app.post("/subscribe", (req, res) => {
  global.subscription = req.body;
  res.json({message: "Subscription saved!"});
});


// Send push notification
async function sendPushNotification(post) {
  if (!global.subscription) {
    console.log("No subscription saved!");
    return;
  }

  const payload = JSON.stringify({
    title: "Hey, It's time to post your Scheduled WhatsApp Status!",
    body: post.caption,
    type: post.type,
    file: post.file,
  });

  const results = await Promise.allSettled(subscriptions.map(sub => 
    webpush.sendNotification(sub, payload).catch(err => {throw {err, sub}; })
  ));

  // Remove invalid ones
  let changed = false;
  results.forEach(result => {
    if (result.status === "rejected" && result.reason.sub) {
      const bad = result.reason.sub;
      console.warn("Removing invalid subscription:", bad.endpoint);
      subscriptions = subscriptions.filter(subsc => subsc.endpoint !== bad.endpoint)
      changed = true;
    }
  });
  if (changed) saveSubscription(subscriptions);
}

// Root page
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/optimizer", (req, res) => {
  res.render("optimizer", { message: null, downloadUrl: null });
});

app.post("/process-video", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.render("optimizer", { message: "Please upload a video!", downloadUrl: null });
  }

  const localPath = req.file.path;

  try {
    const start = parseFloat(req.body.start) || 0;
    const end = parseFloat(req.body.end) || 0;
    const duration = Math.max(end - start, 1); //ensure duration > 0

    // Upload & create eager (transcoded) version so result is available immediately
    const result = await cloudinary.uploader.upload(localPath, {
      resource_type: "video",
      folder: "statusSnap",
      chunk_size: 6000000, // 6 mb chunks
      public_id: `status_${Date.now()}`,
      overwrite: true,
      // Eager transformations are generated during upload and returned in the result
      eager: [
        {
          start_offset: req.body.start || "0", // where trimming starts
          width: 720,  // WhatsApp-friendly transformation:
          crop: "limit",            // limit to 720 while preserving aspect ratio
          format: "mp4",
          transformation: [
            {video_codec: "auto"},
            {audio_codec: "aac"},
            {quality: "auto"},
            {fetch_format: "mp4"}
          ]
        }
      ],
      eager_async: false, // wait for eager transform before returning (default false)
      invalidate: true
    });

    // the transformed asset (first eager) is typically in result.eager[0].secure_url
    const downloadUrl = (result.eager && result.eager[0] && result.eager[0].secure_url) || result.secure_url;

    // cleanup local file
    await fsp.unlink(localPath).catch(()=>{});

    // render page with download link
    return res.render("optimizer", {
      message: "Video processed successfully!",
      downloadUrl
    });

  } catch (err) {
    console.log(err);
    console.error("Cloudinary upload/transform error:", err);
    await fsp.unlink(localPath).catch(()=>{});
    return res.render("optimizer", {
      message: "Error processing video via Cloudinary. Try again.",
      downloadUrl: null
    });
  }
});

// Get the schedule route
app.get("/schedule", (req, res) => {
  res.render("schedule");
});

app.post("/schedule", upload.single("media"), (req, res) => {
  const {caption, scheduleTime, type} = req.body;
  const file = req.file && `/uploads/${req.file.filename}`;

  const post = {
    id: Date.now(),
    caption, 
    type, 
    file, 
    scheduleTime
  };

  posts.push(post);

  // Schedule the reminder
  const job = schedule.scheduleJob(new Date(scheduleTime), () => {
    sendPushNotification(post);
    // Delete post after it's executed
    posts = posts.filter(p => p.id !== post.id);
    if (file) fs.unlink(`./public${file}`, () => {});
  });
  res.render("success", {post});
});

app.get("/reminders", (req, res) => {
  res.render("reminders", {posts});
});

app.get("/reminders", (req, res) => res.render("reminders", {posts}));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
