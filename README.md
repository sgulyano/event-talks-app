# BigQuery Release Navigator

A premium, responsive dark-mode web application built with a **Python Flask** backend and a **Vanilla HTML5/CSS3/JavaScript** frontend. It fetches, parses, filters, and shares BigQuery release notes directly from the official Google Cloud feeds.

---

## 🛠️ Architecture & Code Files

The application contains the following key components:

1. **Backend Server (`app.py`)**: 
   - [app.py](./app.py)
   - Implements a Flask server that exposes API routes (`/api/releases`) and serves the frontend index page.
   - Fetches Google Cloud's BigQuery Atom XML feed and parses updates dynamically using `BeautifulSoup` to break down raw daily HTML updates into structured, categorizable cards.
   - Implements a 5-minute file-based JSON cache (`feed_cache.json`) to minimize external network latency.

2. **Frontend Template (`templates/index.html`)**:
   - [templates/index.html](./templates/index.html)
   - Sets up the structural markup using modern semantic HTML5 elements.
   - Embeds clean SVG icons and designs a modular layout containing sidebar controls, stats, search elements, timeline container, and a custom Tweet composer modal.

3. **Styling Engine (`static/css/styles.css`)**:
   - [static/css/styles.css](./static/css/styles.css)
   - Implements a complete design system based on dynamic HSL CSS color variables.
   - Styled with a premium dark-mode theme utilizing glassmorphism (`backdrop-filter`), smooth gradients, layout grid structures, and interactive states.
   - Houses custom styles for timeline elements, category-specific card highlight borders, and an SVG progress-ring animation for character limits.

4. **Interactive Logic (`static/js/app.js`)**:
   - [static/js/app.js](./static/js/app.js)
   - Orchestrates all dynamic behavior: fetches backend data, manages states (selection, filter settings, search query), and renders timeline structures.
   - Handles text searching and category filtering (Feature, Changed, Deprecated, Fixed).
   - Features a multi-select clipboard copy mechanism and a **custom Tweet Composer** modal with a character counter, limit enforcement (280 characters), and circular SVG countdown progress bar that calls Twitter Web Intents.

5. **Python Dependencies (`requirements.txt`)**:
   - [requirements.txt](./requirements.txt)
   - Contains required third-party libraries: `flask`, `requests`, and `beautifulsoup4`.

---

## ✨ Premium Features Included

* **Visual Timelines**: Generates a continuous vertical timeline connecting update days.
* **Granular Update Cards**: Instead of rendering a single massive daily update block, the backend parses individual headers (`<h3>`) to split items into independent, selectable cards.
* **Dynamic Badges**: Automatically color-coded borders and badges based on the type of update:
  * **Feature**: Green border
  * **Changed**: Orange border
  * **Deprecated**: Red border
  * **Fixed**: Blue border
* **Interactive Selection Panel**: Click multiple updates across different dates to auto-generate a compiled, bulleted summary for a tweet.
* **Circular Progress Tweet Composer**: Type and edit tweets in a custom modal that prevents posting if you exceed 280 characters and shows a beautiful SVG progress countdown wheel.
* **Performance Cache**: Fetches are fast due to local file caching with visual indicators for the cache age. Click the "Refresh" button to clear cache and download live updates from Google.

---

## 🚀 How to Run the App

1. Make sure you are in the project folder: `C:\Users\sguly\Documents\agy\cli-proj`
2. Run the application using the local virtual environment Python executable:
   ```powershell
   .\venv\Scripts\python.exe app.py
   ```
3. Open your browser and navigate to:
   ```
   http://127.0.0.1:5000
   ```
