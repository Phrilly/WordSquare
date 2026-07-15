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

  function render() {
    const rawValue = input.value;
    const value = cleanInput(rawValue);
    if (value !== rawValue) {
      input.value = value;
    }

    // On some mobile keyboards, programmatic normalization moves the caret to
    // the start, causing the next keypress to prepend. Keep caret at the end.
    if (document.activeElement === input && typeof input.setSelectionRange === 'function') {
      const caretPos = value.length;
      input.setSelectionRange(caretPos, caretPos);
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

  input.addEventListener('input', render);

  clearBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    input.value = '';
    render();
    input.focus();
  });

  panel.addEventListener('click', () => {
    input.focus();
  });

  input.addEventListener('focus', () => {
    panel.classList.add('is-focused');
  });

  input.addEventListener('blur', () => {
    panel.classList.remove('is-focused');
  });

  document.addEventListener('ws:dictionaryLoaded', render);
});
