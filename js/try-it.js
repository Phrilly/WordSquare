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
    focusInput();
  });

  const KEYBOARD_SETTLE_DELAYS_MS = [0, 150, 350, 700, 1200];
  const FIT_MARGIN_PX = 16;
  const PIN_BOTTOM_GAP_PX = 6;
  const viewport = window.visualViewport || null;
  let fullPanelHeight = 0;
  let pendingFrame = 0;
  let settleTimers = [];
  let placeholder = null;

  // The panel is pinned directly above the keyboard while typing. This does
  // not depend on page scrolling, which browsers handle inconsistently.
  function pinPanel() {
    if (panel.classList.contains('is-pinned')) return;
    fullPanelHeight = panel.offsetHeight;
    placeholder = document.createElement('div');
    placeholder.style.height = fullPanelHeight + 'px';
    placeholder.style.width = '100%';
    placeholder.setAttribute('aria-hidden', 'true');
    panel.parentNode.insertBefore(placeholder, panel);
    panel.classList.add('is-pinned');
  }

  function unpinPanel() {
    panel.classList.remove('is-pinned', 'is-compact');
    panel.style.removeProperty('bottom');
    if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
    placeholder = null;
  }

  function fitAboveKeyboard() {
    pendingFrame = 0;
    if (document.activeElement !== input) return;

    try {
      let keyboardOverlap = 0;
      let availableHeight = window.innerHeight;
      if (viewport) {
        keyboardOverlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        availableHeight = viewport.height;
      }
      panel.style.bottom = (keyboardOverlap + PIN_BOTTOM_GAP_PX) + 'px';
      panel.classList.toggle('is-compact', fullPanelHeight + FIT_MARGIN_PX > availableHeight * 0.6);
    } catch (error) {
      console.warn('TRY IT keyboard positioning failed:', error);
      panel.classList.add('is-compact');
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
    pinPanel();
    clearSettleTimers();
    // Keyboards animate in at different speeds, so re-check as it settles.
    settleTimers = KEYBOARD_SETTLE_DELAYS_MS.map((delay) => window.setTimeout(scheduleFit, delay));
    if (viewport) {
      viewport.addEventListener('resize', scheduleFit);
      viewport.addEventListener('scroll', scheduleFit);
    }
    window.addEventListener('resize', scheduleFit);
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
    window.removeEventListener('resize', scheduleFit);
    window.removeEventListener('orientationchange', scheduleFit);
    unpinPanel();
  }

  input.addEventListener('focus', () => {
    panel.classList.add('is-focused');
    placeCaretAtEnd();
    startKeyboardTracking();
  });

  input.addEventListener('blur', () => {
    panel.classList.remove('is-focused');
    stopKeyboardTracking();
  });

  document.addEventListener('ws:dictionaryLoaded', render);
});
