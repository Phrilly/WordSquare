document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('try-it-panel');
  const input = document.getElementById('try-it-input');
  const forwardTiles = document.getElementById('try-forward-tiles');
  const reverseTiles = document.getElementById('try-reverse-tiles');
  const forwardRow = document.getElementById('try-forward-row');
  const reverseRow = document.getElementById('try-reverse-row');
  const forwardStatus = document.getElementById('try-forward-status');
  const reverseStatus = document.getElementById('try-reverse-status');
  const clearBtn = document.getElementById('try-it-clear-btn');

  if (!panel || !input || !forwardTiles || !reverseTiles || !forwardRow || !reverseRow || !forwardStatus || !reverseStatus || !clearBtn) {
    return;
  }

  const EMPTY_STATUS = 'Type 3-5 letters';

  function buildTiles(container) {
    container.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const tile = document.createElement('div');
      tile.className = 'try-tile';
      tile.dataset.index = String(i);
      container.appendChild(tile);
    }
  }

  function cleanInput(raw) {
    return String(raw || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .substring(0, 5);
  }

  function getValidityClass(word) {
    if (!word || word.length < 3 || word.length > 5) return '';
    if (!(typeof gameDictionary !== 'undefined' && gameDictionary && gameDictionary.has(word))) return '';
    return 'is-valid-' + word.length;
  }

  function setRowState(rowEl, statusEl, word) {
    rowEl.classList.remove('is-valid-3', 'is-valid-4', 'is-valid-5');

    if (!word || word.length < 3) {
      statusEl.textContent = EMPTY_STATUS;
      return;
    }

    const inDictionary = (typeof gameDictionary !== 'undefined' && gameDictionary && gameDictionary.has(word));
    if (inDictionary) {
      const cls = getValidityClass(word);
      if (cls) rowEl.classList.add(cls);
      statusEl.textContent = 'In dictionary';
    } else {
      statusEl.textContent = 'Not in dictionary';
    }
  }

  function paintTiles(container, word) {
    const letters = word.split('');
    const tileNodes = container.querySelectorAll('.try-tile');
    tileNodes.forEach((tile, idx) => {
      const char = letters[idx] || '';
      tile.textContent = char;
      tile.classList.toggle('has-char', Boolean(char));
    });
  }

  function placeCaretAtEnd() {
    if (typeof input.setSelectionRange !== 'function') return;
    const end = input.value.length;
    if (input.selectionStart !== end || input.selectionEnd !== end) {
      try {
        input.setSelectionRange(end, end);
      } catch (error) {
        console.warn('TRY IT caret placement failed:', error);
      }
    }
  }

  function focusInput() {
    try {
      input.focus({ preventScroll: true });
    } catch (error) {
      input.focus();
    }
    placeCaretAtEnd();
  }

  function render() {
    const rawValue = input.value;
    const value = cleanInput(rawValue);
    if (value !== rawValue) {
      input.value = value;
    }

    // iOS moves the caret to the start after programmatic value changes, so
    // the next keypress would prepend and Backspace would delete nothing.
    if (document.activeElement === input) {
      placeCaretAtEnd();
    }

    const reversed = value.split('').reverse().join('');

    paintTiles(forwardTiles, value);
    paintTiles(reverseTiles, reversed);

    setRowState(forwardRow, forwardStatus, value);
    setRowState(reverseRow, reverseStatus, reversed);
  }

  buildTiles(forwardTiles);
  buildTiles(reverseTiles);
  render();

  // The field is treated as append-only: edits always act on the end of the
  // text regardless of where the platform thinks the caret is.
  input.addEventListener('beforeinput', (event) => {
    if (event.isComposing || !event.cancelable) return;
    const type = String(event.inputType || '');

    if (type === 'deleteContentBackward' || type === 'deleteContentForward') {
      event.preventDefault();
      input.value = input.value.slice(0, -1);
      render();
    } else if (type.indexOf('delete') === 0) {
      event.preventDefault();
      input.value = '';
      render();
    } else if (type === 'insertText' || type === 'insertFromPaste' || type === 'insertReplacementText') {
      event.preventDefault();
      const incoming = cleanInput(event.data !== null && event.data !== undefined
        ? event.data
        : (event.dataTransfer ? event.dataTransfer.getData('text') : ''));
      input.value = cleanInput(input.value + incoming);
      render();
    }
  });

  input.addEventListener('input', render);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      input.blur();
    }
  });

  // Keep the caret at the end whenever the platform moves it.
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === input) placeCaretAtEnd();
  });

  // Tapping CLEAR must not take focus away from the input (keeps the iPad keyboard open).
  clearBtn.addEventListener('pointerdown', (event) => {
    if (document.activeElement === input) event.preventDefault();
  });

  clearBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    input.value = '';
    render();
    focusInput();
  });

  // Desktop: clicking panel chrome must not blur an already-focused input.
  panel.addEventListener('mousedown', (event) => {
    if (document.activeElement === input) event.preventDefault();
  });

  panel.addEventListener('click', () => {
    if (document.activeElement === input && keyboardWasDismissed()) {
      // The keyboard was closed without blurring the field (Android back, iPad dismiss key).
      // Blur first so the focus below is a real focus and reopens the keyboard.
      input.blur();
    }
    focusInput();
    if (document.activeElement === input) scheduleFit();
  });

  const KEYBOARD_SETTLE_DELAYS_MS = [0, 150, 350, 700, 1200];
  const PANEL_EDGE_GAP_PX = 8;
  const FIT_MARGIN_PX = 16;
  const PIN_BOTTOM_GAP_PX = 6;
  const KEYBOARD_MIN_HEIGHT_PX = 120;
  const BASELINE_REFRESH_DELAY_MS = 600;
  const viewport = window.visualViewport || null;
  const rootEl = document.documentElement;
  let fullPanelHeight = 0;
  let pendingFrame = 0;
  let settleTimers = [];
  let baselineHeight = viewport ? viewport.height : window.innerHeight;
  let keyboardSeenOpen = false;
  let placeholder = null;

  // Last-resort layout: fix the panel just above the keyboard so it can never be hidden,
  // whatever the browser does with scrolling. A placeholder stops the page jumping.
  function pinPanel() {
    if (panel.classList.contains('is-pinned')) return;
    if (debugEnabled) debugLog('PIN');
    placeholder = document.createElement('div');
    placeholder.style.height = panel.offsetHeight + 'px';
    placeholder.setAttribute('aria-hidden', 'true');
    panel.parentNode.insertBefore(placeholder, panel);
    panel.classList.add('is-pinned', 'is-compact');
  }

  function unpinPanel() {
    panel.classList.remove('is-pinned');
    panel.style.removeProperty('bottom');
    if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
    placeholder = null;
  }

  // Height of the visible area when no keyboard is showing.
  function refreshBaseline() {
    if (!viewport || document.activeElement === input) return;
    baselineHeight = viewport.height;
  }

  function keyboardWasDismissed() {
    return Boolean(viewport) && viewport.height >= baselineHeight - KEYBOARD_MIN_HEIGHT_PX;
  }

  // Keeps the panel visible above the on-screen keyboard. If the full panel
  // cannot fit in the space left, it switches to a compact layout.
  function fitAboveKeyboard() {
    pendingFrame = 0;
    if (document.activeElement !== input) return;
    if (debugEnabled) debugLog('fit');

    try {
      if (!viewport) {
        pinPanel();
        panel.style.bottom = PIN_BOTTOM_GAP_PX + 'px';
        return;
      }

      if (!keyboardWasDismissed()) {
        keyboardSeenOpen = true;
      } else if (keyboardSeenOpen) {
        // The user closed the keyboard; reset so the next tap starts cleanly.
        if (debugEnabled) debugLog('auto-blur(kb closed)');
        input.blur();
        return;
      }

      const keyboardOverlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      rootEl.style.setProperty('--try-it-kb', keyboardOverlap + 'px');
      rootEl.classList.add('try-it-kb-open');

      if (panel.classList.contains('is-pinned')) {
        panel.style.bottom = (keyboardOverlap + PIN_BOTTOM_GAP_PX) + 'px';
        return;
      }

      const fits = fullPanelHeight + FIT_MARGIN_PX <= viewport.height;
      panel.classList.toggle('is-compact', !fits);

      const visibleBottom = viewport.offsetTop + viewport.height - PANEL_EDGE_GAP_PX;
      const visibleTop = viewport.offsetTop + PANEL_EDGE_GAP_PX;
      let rect = panel.getBoundingClientRect();
      if (rect.bottom > visibleBottom) {
        window.scrollBy(0, rect.bottom - visibleBottom);
      } else if (rect.top < visibleTop) {
        window.scrollBy(0, rect.top - visibleTop);
      }

      // Scrolling is not reliable on every browser, so verify and fall back to pinning.
      rect = panel.getBoundingClientRect();
      if (rect.bottom > visibleBottom + 1 || rect.top < visibleTop - 1) {
        pinPanel();
        panel.style.bottom = (keyboardOverlap + PIN_BOTTOM_GAP_PX) + 'px';
      }
    } catch (error) {
      console.warn('TRY IT keyboard positioning failed:', error);
      pinPanel();
      panel.style.bottom = PIN_BOTTOM_GAP_PX + 'px';
    }
  }

  function scheduleFit() {
    if (pendingFrame) return;
    pendingFrame = window.requestAnimationFrame(fitAboveKeyboard);
  }

  function clearSettleTimers() {
    settleTimers.forEach((timerId) => window.clearTimeout(timerId));
    settleTimers = [];
  }

  function startKeyboardTracking() {
    if (!panel.classList.contains('is-compact')) {
      fullPanelHeight = panel.offsetHeight;
    }
    keyboardSeenOpen = false;
    clearSettleTimers();
    // Keyboards animate in at different speeds, so re-check as it settles.
    settleTimers = KEYBOARD_SETTLE_DELAYS_MS.map((delay) => window.setTimeout(scheduleFit, delay));
    if (viewport) {
      viewport.addEventListener('resize', scheduleFit);
      viewport.addEventListener('scroll', scheduleFit);
    }
    window.addEventListener('orientationchange', scheduleFit);
  }

  function stopKeyboardTracking() {
    clearSettleTimers();
    if (pendingFrame) {
      window.cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
    }
    if (viewport) {
      viewport.removeEventListener('resize', scheduleFit);
      viewport.removeEventListener('scroll', scheduleFit);
    }
    window.removeEventListener('orientationchange', scheduleFit);
    keyboardSeenOpen = false;
    unpinPanel();
    panel.classList.remove('is-compact');
    rootEl.classList.remove('try-it-kb-open');
    rootEl.style.removeProperty('--try-it-kb');
    window.setTimeout(refreshBaseline, BASELINE_REFRESH_DELAY_MS);
  }

  window.addEventListener('orientationchange', () => window.setTimeout(refreshBaseline, BASELINE_REFRESH_DELAY_MS));
  if (viewport) viewport.addEventListener('resize', refreshBaseline);

  // Diagnostic strip, shown only when the page URL contains ?debug=1.
  const debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';
  let debugEl = null;
  let debugTimer = 0;
  let debugEvents = [];

  function debugLog(label) {
    debugEvents.push(label);
    if (debugEvents.length > 6) debugEvents.shift();
  }

  function debugRender() {
    if (!debugEl) return;
    const rect = panel.getBoundingClientRect();
    const vvHeight = viewport ? Math.round(viewport.height) : 'none';
    const vvTop = viewport ? Math.round(viewport.offsetTop) : 'none';
    debugEl.textContent = [
      'v' + ((window.GAME_CONFIG && window.GAME_CONFIG.appVersion) || '?'),
      'innerH=' + window.innerHeight + ' vvH=' + vvHeight + ' vvTop=' + vvTop + ' base=' + Math.round(baselineHeight),
      'panel top=' + Math.round(rect.top) + ' bottom=' + Math.round(rect.bottom) + ' fullH=' + fullPanelHeight,
      'scrollY=' + Math.round(window.scrollY) + ' docH=' + rootEl.scrollHeight + ' kbSeen=' + keyboardSeenOpen,
      'classes=' + panel.className,
      'focused=' + (document.activeElement === input) + ' bottomStyle=' + (panel.style.bottom || '-'),
      'log: ' + debugEvents.join(' | ')
    ].join('\n');
  }

  if (debugEnabled) {
    debugEl = document.createElement('pre');
    debugEl.setAttribute('aria-hidden', 'true');
    debugEl.style.cssText = 'position:fixed;top:0;left:0;right:0;margin:0;padding:4px 6px;z-index:2147483647;' +
      'background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.3 monospace;white-space:pre-wrap;pointer-events:none;';
    document.body.appendChild(debugEl);
    debugTimer = window.setInterval(debugRender, 250);
    if (viewport) {
      viewport.addEventListener('resize', () => debugLog('vv-resize ' + Math.round(viewport.height)));
    }
    window.addEventListener('resize', () => debugLog('win-resize ' + window.innerHeight));
    panel.addEventListener('click', () => debugLog('panel-click'));
    debugRender();
  }

  input.addEventListener('focus', () => {
    if (debugEnabled) debugLog('focus');
    panel.classList.add('is-focused');
    placeCaretAtEnd();
    startKeyboardTracking();
  });

  input.addEventListener('blur', () => {
    if (debugEnabled) debugLog('blur');
    panel.classList.remove('is-focused');
    stopKeyboardTracking();
  });

  document.addEventListener('ws:dictionaryLoaded', render);
});
