// ================================
// MY FIRST DICTIONARY VARIANT LOGIC
// ================================

document.addEventListener('ws:beforeInit', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isCommonDay) return;

    // Verify the common dictionary file loaded successfully
    if (typeof commonDictionary !== 'undefined') {
        
        // Swap the global pointer. 
        // The core engine will now automatically only recognize, highlight, and score these common words!
        gameDictionary = commonDictionary;
        
        console.log("My First Dictionary Variant Active: Dictionary heavily constrained to " + gameDictionary.size + " words.");
    } else {
        console.warn("commonDictionary not found. Falling back to the standard global dictionary.");
    }
});

// ---------------------------------------------------------
// SMART ALPHABET MODAL LOGIC (COLOR CODED BY LENGTH)
// ---------------------------------------------------------
window.updateWildcardModal = function() {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isCommonDay) return;
    
    // Ensure we actually have a target cell selected
    if (typeof pendingCellIndex === 'undefined' || pendingCellIndex === null || pendingCellIndex === -1) return;

    // Grab the words currently on the board before the wildcard is placed
    const currentWords = findValidWordsLocalArray(cells);
    const alphabetGrid = document.getElementById('alphabet-modal');
    if (!alphabetGrid) return;

    // Target all interactive elements inside the modal
    const allBtns = alphabetGrid.querySelectorAll('div, button, .alpha-cell');
    
    allBtns.forEach(btn => {
        const text = btn.innerText.trim().toUpperCase();
        
        // Strip out any previous length highlights just in case
        btn.classList.remove('smart-highlight-3', 'smart-highlight-4', 'smart-highlight-5');
        
        // Ensure we are only calculating against actual A-Z tile buttons (ignore "Cancel")
        if (text.length === 1 && text >= 'A' && text <= 'Z') {
            
            // Create a temporary clone of the board and place this specific letter
            const tempCells = [...cells];
            tempCells[pendingCellIndex] = text;
            
            // Check if placing this letter creates any new words
            const newWords = findValidWordsLocalArray(tempCells).filter(w => !currentWords.includes(w));
            
            if (newWords.length > 0) {
                // Find the longest word this letter creates
                let maxLength = 0;
                newWords.forEach(w => {
                    if (w.length > maxLength) maxLength = w.length;
                });

                // Apply the correct color class based on the maximum length found
                if (maxLength === 3) {
                    btn.classList.add('smart-highlight-3');
                } else if (maxLength === 4) {
                    btn.classList.add('smart-highlight-4');
                } else if (maxLength >= 5) {
                    btn.classList.add('smart-highlight-5');
                }
            }
        }
    });
};