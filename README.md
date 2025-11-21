# What each file does
index.html: App shell with reader surface, navigation controls, zoom + pinch targets, bookmarks/history panes, encryption key input, and offline/theme toggles.  
assets/css/styles.css: Intentional gradient look, serif/sans pairing, responsive grids, page-turn animations, touch-friendly controls, day/dark theme tokens.  
assets/js/main.js: Loads sample book, AES-GCM encrypts book/bookmarks/history in localStorage, navigation + smooth turn animations, history tracking, bookmark CRUD, zoom controls with pinch/double-tap, theme switcher, offline precache trigger messaging.  
assets/data/sample-book.json & assets/images/page*.svg/@2x.svg: High-res friendly sample pages with srcset for retina rendering.  
service-worker.js & manifest.json: Offline cache of core assets and data; postMessage hook for manual “Cache for offline”; PWA metadata and icons.  

# How to run
Serve locally so the service worker can register (e.g., python3 -m http.server 4173 from the repo) and open http://localhost:4173/.
