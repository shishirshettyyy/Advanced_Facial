<div align="center">

# 🎭 Project Drishti

### Advanced Offline Face Recognition Attendance System

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![face-api.js](https://img.shields.io/badge/face--api.js-0.22.2-blueviolet?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge)

**A fully offline, privacy-first attendance system powered by real-time face recognition — no server, no database, no data leaves your device.**

[✨ Features](#-features) • [🚀 Quick Start](#-quick-start) • [🛠️ How It Works](#️-how-it-works) • [📸 Usage Guide](#-usage-guide) • [🔒 Privacy](#-privacy--security) • [🤝 Contributing](#-contributing)

</div>

---

## 📖 Overview

**Project Drishti** (meaning *"vision"* in Sanskrit) is a zero-dependency, browser-native attendance management system built entirely on client-side face recognition. Designed for classrooms, small offices, and any environment where privacy matters, it requires **no internet connection after the initial model load**, no backend infrastructure, and stores all data exclusively in the user's browser via `localStorage`.

> _"Intelligence that sees — privately, instantly, offline."_

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **Real-time Face Recognition** | Identifies enrolled individuals instantly using TinyFaceDetector + FaceRecognitionNet |
| 📴 **Fully Offline** | After first load, works entirely without internet access |
| 💾 **Persistent Storage** | Face descriptors saved in `localStorage` — survive browser refreshes |
| 🔔 **Audio Feedback** | Plays a beep sound using the Web Audio API when a student is marked present |
| 🔒 **Privacy First** | No data is ever sent to any server — everything stays on-device |
| 🪞 **Mirror Mode** | Camera feed is mirrored for natural self-view during enrollment |
| 🗂️ **Duplicate Guard** | Prevents double-enrollment and duplicate attendance entries |
| ✅ **Timestamped Attendance** | Each attendance record is logged with a precise timestamp |
| 🗑️ **Safe Data Clearing** | Confirmation modal prevents accidental data loss |
| 📱 **Responsive UI** | Clean 3-column grid layout, mobile-friendly with Tailwind CSS |

---

## 🚀 Quick Start

### Prerequisites

- A modern web browser (Chrome, Edge, Firefox, Safari)
- A working **webcam**
- Internet connection *(for first load — to fetch ML models and CDN assets)*

### Installation

```bash
# Clone the repository
git clone https://github.com/shishirshettyyy/Advanced_Facial.git

# Navigate to the project directory
cd Advanced_Facial
```

### Running the App

Simply open `index.html` in your browser:

```bash
# Option 1 — Open directly (some browsers may restrict webcam via file://)
start index.html   # Windows
open index.html    # macOS

# Option 2 — Recommended: serve locally
npx serve .
# or
python -m http.server 8080
# then visit http://localhost:8080
```

> **⚠️ Note:** For webcam access to work reliably, it's recommended to serve the file via a local HTTP server rather than opening it directly as a `file://` URL.

---

## 🛠️ How It Works

### Tech Stack

| Layer | Technology |
|---|---|
| **UI Framework** | [Tailwind CSS](https://tailwindcss.com/) via CDN |
| **Face Detection** | [face-api.js](https://github.com/justadudewhohacks/face-api.js) v0.22.2 |
| **ML Models** | TinyFaceDetector · FaceLandmark68TinyNet · FaceRecognitionNet |
| **Storage** | Browser `localStorage` (JSON-serialized face descriptors) |
| **Audio** | Web Audio API (no external files) |
| **Camera** | `getUserMedia` Web API |

### ML Pipeline

```
Webcam Frame
    │
    ▼
TinyFaceDetector        ← Fast bounding box detection
    │
    ▼
FaceLandmark68TinyNet   ← 68-point facial landmark extraction
    │
    ▼
FaceRecognitionNet      ← 128-dimensional face embedding
    │
    ▼
FaceMatcher             ← Euclidean distance comparison against enrolled descriptors
    │
    ▼
Attendance Logged ✅
```

Models are loaded from the [jsDelivr CDN](https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights) on first launch.

---

## 📸 Usage Guide

### Step 1 — Enroll Students

1. Position the student's face clearly in the live camera feed.
2. Enter the student's full name in the **"Enter Student's Name"** field.
3. Click **"Enroll Student"**.
4. A success message confirms enrollment and the name appears in the enrolled list.
5. Repeat for each student. Data is automatically saved to `localStorage`.

> 💡 _Tip: Good lighting and a straight-on face angle produce the best descriptor quality._

### Step 2 — Take Attendance

1. Click **"Start Taking Attendance"** (button turns yellow to indicate active mode).
2. The system scans faces from the webcam every **500ms**.
3. Recognized faces are outlined with a bounding box showing their name.
4. A **beep** plays and the student is added to the attendance list with a timestamp.
5. Each student is only marked once per session (duplicate-safe).
6. Click **"Stop Attendance"** to end the session.

### Step 3 — Manage Data

- The **Attendance List** panel shows all present students with entry times.
- Click **"Clear All Data"** to wipe enrolled students and attendance (confirmation required).

---

## 🔒 Privacy & Security

Project Drishti is designed with a **privacy-by-default** philosophy:

- ✅ **No server communication** — face embeddings never leave the browser.
- ✅ **No cloud storage** — all data lives in `localStorage` on the user's device.
- ✅ **No cookies or tracking** — zero third-party analytics.
- ✅ **Open source** — full transparency into how biometric data is handled.
- ✅ **User-controlled deletion** — one click clears all biometric data permanently.

> _Face descriptors stored in `localStorage` are 128-dimensional numerical vectors — they cannot be used to reconstruct the original face image._

---

## 📁 Project Structure

```
Advanced_Facial/
├── index.html          # Main application (single-file architecture)
├── frontend/
│   └── index.html      # Frontend entry point
└── README.md           # Project documentation
```

The entire application lives in a **single HTML file** — making it trivially easy to deploy, share, and maintain.

---

## ⚡ Performance

| Metric | Value |
|---|---|
| Attendance scan interval | Every 500ms |
| Model size (approx.) | ~6 MB (loaded from CDN) |
| Storage per enrolled student | ~4 KB in localStorage |
| Supported browsers | Chrome 80+, Edge 80+, Firefox 72+, Safari 14+ |

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/<your-username>/Advanced_Facial.git
cd Advanced_Facial

# Create your feature branch
git checkout -b feature/your-feature-name

# Make your changes, then commit
git add .
git commit -m "feat: describe your change"

# Push and open a Pull Request
git push origin feature/your-feature-name
```

### Ideas for Contribution

- [ ] Export attendance as CSV / PDF
- [ ] Multi-session attendance history
- [ ] IndexedDB support for larger datasets
- [ ] Dark mode toggle
- [ ] Camera selection (for multi-camera setups)
- [ ] Confidence threshold slider for recognition sensitivity

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgements

- [face-api.js](https://github.com/justadudewhohacks/face-api.js) by **Vincent Mühler** — the core ML library powering face detection and recognition.
- [Tailwind CSS](https://tailwindcss.com/) — utility-first CSS framework for the clean UI.
- [Google Fonts — Inter](https://fonts.google.com/specimen/Inter) — the typeface used throughout the app.

---

<div align="center">

Made with ❤️ by [shishirshettyyy](https://github.com/shishirshettyyy)

⭐ **Star this repo if you found it useful!** ⭐

</div>
