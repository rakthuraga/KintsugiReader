const selectors = {
  prev: document.getElementById('prevPage'),
  next: document.getElementById('nextPage'),
  pageCounter: document.getElementById('pageCurrent'),
  pageTotal: document.getElementById('pageTotal'),
  chapterLabel: document.getElementById('chapterLabel'),
  pageText: document.getElementById('pageText'),
  pageImage: document.querySelector('#pageImage img'),
  pageFrame: document.getElementById('pageFrame'),
  pageBody: document.getElementById('pageBody'),
  pageSeek: document.getElementById('pageSeek'),
  progressLabel: document.getElementById('progressLabel'),
  bookmarkList: document.getElementById('bookmarkList'),
  historyList: document.getElementById('historyList'),
  addBookmark: document.getElementById('addBookmark'),
  clearHistory: document.getElementById('clearHistory'),
  zoomSlider: document.getElementById('zoomSlider'),
  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  resetZoom: document.getElementById('resetZoom'),
  toggleOffline: document.getElementById('toggleOffline'),
  offlineStatus: document.getElementById('offlineStatus'),
  toast: document.getElementById('toast'),
  passInput: document.getElementById('passphraseInput'),
  applyPass: document.getElementById('applyPassphrase'),
  toggleTheme: document.getElementById('toggleTheme'),
};

const DEFAULT_PASS = 'kintsugi-reader';
const RANGE = { min: 0.9, max: 2.5 };
const STORAGE_KEYS = {
  book: 'kr.book',
  bookmarks: 'kr.bookmarks',
  history: 'kr.history',
  pass: 'kr.passphrase',
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const state = {
  book: null,
  currentPage: 0,
  scale: 1,
  bookmarks: [],
  history: [],
  cryptoKey: null,
  passphrase: DEFAULT_PASS,
  offlineReady: false,
  theme: 'dark',
};

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function showToast(message) {
  selectors.toast.textContent = message;
  selectors.toast.classList.add('show');
  setTimeout(() => selectors.toast.classList.remove('show'), 1800);
}

async function deriveKey(passphrase) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(passphrase));
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptPayload(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    state.cryptoKey,
    encoder.encode(JSON.stringify(data)),
  );
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
}

async function decryptPayload(payload) {
  const iv = new Uint8Array(payload.iv);
  const data = new Uint8Array(payload.data);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, state.cryptoKey, data);
  return JSON.parse(decoder.decode(plain));
}

async function persistEncrypted(key, data) {
  const encrypted = await encryptPayload(data);
  localStorage.setItem(key, JSON.stringify(encrypted));
}

async function loadEncrypted(key, fallback = null) {
  const stored = localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return await decryptPayload(JSON.parse(stored));
  } catch (err) {
    console.warn('Decrypt failed, clearing payload', err);
    localStorage.removeItem(key);
    return fallback;
  }
}

async function loadBook() {
  const cached = await loadEncrypted(STORAGE_KEYS.book);
  if (cached) {
    state.book = cached;
    return;
  }
  const response = await fetch('assets/data/sample-book.json');
  const book = await response.json();
  state.book = book;
  await persistEncrypted(STORAGE_KEYS.book, book);
}

function renderPage() {
  if (!state.book) return;
  const page = state.book.pages[state.currentPage];
  selectors.pageCounter.textContent = state.currentPage + 1;
  selectors.pageTotal.textContent = state.book.pages.length;
  selectors.chapterLabel.textContent = page.title;
  selectors.pageText.innerHTML = `<h2>${page.title}</h2>${page.body
    .map((p) => `<p>${p}</p>`)
    .join('')}`;

  selectors.pageImage.src = page.image.regular;
  selectors.pageImage.srcset = `${page.image.regular} 1x, ${page.image.retina} 2x`;
  selectors.pageImage.alt = page.image.alt;

  selectors.pageSeek.max = state.book.pages.length;
  selectors.pageSeek.value = state.currentPage + 1;
  const progress = Math.round((state.currentPage / (state.book.pages.length - 1)) * 100);
  selectors.progressLabel.textContent = Number.isFinite(progress) ? `${progress}%` : '0%';

  selectors.pageFrame.classList.remove('turn-forward', 'turn-back');
}

function goToPage(target) {
  if (!state.book) return;
  const total = state.book.pages.length;
  const next = clamp(target, 0, total - 1);
  const direction = next > state.currentPage ? 'turn-forward' : 'turn-back';
  state.currentPage = next;
  renderPage();
  selectors.pageFrame.classList.add(direction);
  addHistory(next);
}

function addHistory(pageIndex) {
  const entry = { page: pageIndex, at: Date.now() };
  state.history = [entry, ...state.history.filter((h) => h.page !== pageIndex)].slice(0, 35);
  persistEncrypted(STORAGE_KEYS.history, state.history);
  renderHistory();
}

function addBookmark() {
  if (!state.book) return;
  const exists = state.bookmarks.find((b) => b.page === state.currentPage);
  if (exists) {
    showToast('Already bookmarked');
    return;
  }
  state.bookmarks.unshift({ page: state.currentPage, at: Date.now() });
  persistEncrypted(STORAGE_KEYS.bookmarks, state.bookmarks);
  renderBookmarks();
  showToast('Bookmark saved');
}

function renderBookmarks() {
  selectors.bookmarkList.innerHTML = '';
  if (!state.bookmarks.length) {
    selectors.bookmarkList.innerHTML = '<li>None yet—add your first bookmark.</li>';
    return;
  }
  state.bookmarks.forEach((b) => {
    const li = document.createElement('li');
    const info = document.createElement('span');
    info.textContent = `Page ${b.page + 1}`;
    const actions = document.createElement('div');
    const jump = document.createElement('button');
    jump.textContent = 'Open';
    jump.className = 'pill ghost small';
    jump.onclick = () => goToPage(b.page);
    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.className = 'icon-btn';
    remove.onclick = () => {
      state.bookmarks = state.bookmarks.filter((bk) => bk.page !== b.page);
      persistEncrypted(STORAGE_KEYS.bookmarks, state.bookmarks);
      renderBookmarks();
    };
    actions.append(jump, remove);
    li.append(info, actions);
    selectors.bookmarkList.append(li);
  });
}

function renderHistory() {
  selectors.historyList.innerHTML = '';
  if (!state.history.length) {
    selectors.historyList.innerHTML = '<li>No recent pages.</li>';
    return;
  }
  state.history.forEach((h) => {
    const li = document.createElement('li');
    const info = document.createElement('span');
    const time = new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    info.textContent = `Page ${h.page + 1} · ${time}`;
    const jump = document.createElement('button');
    jump.textContent = 'Open';
    jump.className = 'pill ghost small';
    jump.onclick = () => goToPage(h.page);
    li.append(info, jump);
    selectors.historyList.append(li);
  });
}

function setScale(nextScale) {
  state.scale = clamp(Number(nextScale), RANGE.min, RANGE.max);
  selectors.pageFrame.style.setProperty('--page-scale', state.scale);
  selectors.zoomSlider.value = state.scale;
}

function setupPinch() {
  let baseDistance = null;
  let baseScale = state.scale;
  selectors.pageBody.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      baseDistance = distance(e.touches[0], e.touches[1]);
      baseScale = state.scale;
    }
  });

  selectors.pageBody.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && baseDistance) {
      const next = distance(e.touches[0], e.touches[1]);
      const factor = next / baseDistance;
      setScale(baseScale * factor);
    }
  });

  selectors.pageBody.addEventListener('touchend', () => {
    baseDistance = null;
  });

  selectors.pageBody.addEventListener('dblclick', () => {
    const target = state.scale > 1.4 ? 1 : 1.8;
    setScale(target);
  });
}

function distance(t1, t2) {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

async function prepareCrypto() {
  const savedPass = localStorage.getItem(STORAGE_KEYS.pass) || DEFAULT_PASS;
  selectors.passInput.value = savedPass;
  state.passphrase = savedPass;
  state.cryptoKey = await deriveKey(savedPass);
}

async function loadState() {
  state.bookmarks = (await loadEncrypted(STORAGE_KEYS.bookmarks, [])) || [];
  state.history = (await loadEncrypted(STORAGE_KEYS.history, [])) || [];
  renderBookmarks();
  renderHistory();
}

function setupEvents() {
  selectors.prev.addEventListener('click', () => goToPage(state.currentPage - 1));
  selectors.next.addEventListener('click', () => goToPage(state.currentPage + 1));
  selectors.pageSeek.addEventListener('input', (e) => goToPage(Number(e.target.value) - 1));
  selectors.addBookmark.addEventListener('click', addBookmark);
  selectors.clearHistory.addEventListener('click', () => {
    state.history = [];
    persistEncrypted(STORAGE_KEYS.history, state.history);
    renderHistory();
  });

  selectors.zoomSlider.addEventListener('input', (e) => setScale(e.target.value));
  selectors.zoomIn.addEventListener('click', () => setScale(state.scale + 0.1));
  selectors.zoomOut.addEventListener('click', () => setScale(state.scale - 0.1));
  selectors.resetZoom.addEventListener('click', () => setScale(1));
  selectors.toggleOffline.addEventListener('click', precacheOffline);
  selectors.applyPass.addEventListener('click', async () => {
    const pass = selectors.passInput.value || DEFAULT_PASS;
    state.passphrase = pass;
    state.cryptoKey = await deriveKey(pass);
    localStorage.setItem(STORAGE_KEYS.pass, pass);
    // re-encrypt everything with the new key
    await persistEncrypted(STORAGE_KEYS.book, state.book);
    await persistEncrypted(STORAGE_KEYS.bookmarks, state.bookmarks);
    await persistEncrypted(STORAGE_KEYS.history, state.history);
    showToast('Encryption key updated');
  });

  selectors.toggleTheme.addEventListener('click', toggleTheme);
}

async function precacheOffline() {
  if (!navigator.serviceWorker?.controller) {
    showToast('Enable service worker first');
    return;
  }
  navigator.serviceWorker.controller.postMessage({ type: 'CACHE_NOW' });
  selectors.offlineStatus.textContent = 'Caching…';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'day' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  showToast(`Theme: ${state.theme}`);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./service-worker.js');
    await navigator.serviceWorker.ready;
    selectors.offlineStatus.textContent = 'Offline ready';
    reg.addEventListener('updatefound', () => showToast('Updating offline bundle'));
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data === 'CACHE_DONE') {
        selectors.offlineStatus.textContent = 'Cached offline';
        state.offlineReady = true;
        showToast('Offline cache refreshed');
      }
    });
  } catch (err) {
    console.warn('Service worker registration failed', err);
    selectors.offlineStatus.textContent = 'Offline disabled';
  }
}

async function boot() {
  setupEvents();
  setupPinch();
  document.documentElement.setAttribute('data-theme', state.theme);
  await prepareCrypto();
  await Promise.all([loadBook(), loadState()]);
  renderPage();
  addHistory(state.currentPage);
  await registerServiceWorker();
}

boot();
