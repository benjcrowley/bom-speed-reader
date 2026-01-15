const TRAINING_TEXT = `Welcome to the Science of Feasting. 
This is a new way to read.
Feast upon the words of Christ; for behold, the words of Christ will tell you all things what ye should do.
We are often told to feast, yet for many of us, our daily reading feels more like nibbling.
We pick at a verse here. We read a chapter there.
We struggle to maintain focus. Our minds wander. We lose the thread of the story.
What if the problem isn’t your attention span? 
What if the problem is the mechanical inefficiency of reading itself?
This tool uses a method called Rapid Serial Visual Presentation.
It is not just a fast forward button. 
It is a fundamentally different way of interfacing with text.
When you read a physical page, your eyes do not glide smoothly. They jerk. 
These movements are called saccades. 
Your eye fixes on a word, stops to process it, and then jumps. 
This wastes time. It breaks your focus.
This app eliminates that.
By flashing words in a single, fixed location, your eyes stay perfectly still.
Your brain can now devote 100% of its energy to processing meaning.
Most of us subvocalize. We say the words in our head as we read. 
This limits you to about 150 words per minute. 
But your brain is faster than your tongue.
As this text speeds up, notice what happens.
You break the sound barrier.
You stop hearing words. You start seeing ideas.
You download the text directly into your mind.
This is the Iron Rod of focus. 
Because the words come rapidly, you are forced to pay attention.
You cannot look away. You cannot daydream.
You enter a state of Flow.
The Book of Mormon becomes a movie in your mind.
You see the topography. You see the patterns. You feel the urgency.
Relax your eyes. 
Look through the screen. 
Trust your brain.
If you miss a word, let it go. Context will fill the gaps.
Technology is not a replacement for the Spirit. But it is a powerful vehicle for it.
Use this to survey the landscape. 
Remind yourself that this book is a thrilling, cohesive miracle.
Ready? 
Take a breath. 
Hold to the rod. 
Let’s read.`;

/* --- STATE --- */
const STATE = {
    allChapters: [], currentGlobalIndex: 0, words: [], verseMap: [], wordIndex: 0,
    isPlaying: false, timerId: null, currentWPM: 150, targetWPM: 400, wakeLock: null, zenTimer: null,
    sessionStart: 0, chaptersRead: 0, currentGoal: 'none'
};

/* --- ELEMENTS --- */
const elements = {
    display: document.getElementById('word-display'),
    ghostLeft: document.getElementById('ghost-left'),
    ghostRight: document.getElementById('ghost-right'),
    ponderDisplay: document.getElementById('ponder-display'),
    refDisplay: document.getElementById('current-ref'),
    displayWrapper: document.querySelector('.display-wrapper'),
    wpmRealtime: document.getElementById('realtime-wpm'),
    chapterSelect: document.getElementById('chapter-select'),
    slider: document.getElementById('wpm-slider'),
    sliderLabel: document.getElementById('target-wpm-display'),
    actionBtn: document.getElementById('action-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    token: document.getElementById('progress-token'),
    progressText: document.getElementById('global-progress'),
    goalSelect: document.getElementById('goal-select'),
    infoBtn: document.getElementById('info-btn'),
    modal: document.getElementById('info-modal'),
    closeModal: document.querySelector('.close-modal')
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupEventListeners();
    await loadBookData();
    
    if (localStorage.getItem('bom_theme') === 'dark') document.body.classList.add('dark-mode');
    
    // Safety check for NaN values in LocalStorage
    const savedWPM = localStorage.getItem('bom_wpm');
    if (savedWPM && !isNaN(parseInt(savedWPM))) {
        STATE.targetWPM = parseInt(savedWPM);
        elements.slider.value = STATE.targetWPM;
        elements.sliderLabel.innerText = `${STATE.targetWPM} WPM`;
    }

    const savedChapterIdx = localStorage.getItem('bom_chapter_index');
    if (savedChapterIdx && !isNaN(parseInt(savedChapterIdx))) {
        elements.chapterSelect.value = savedChapterIdx;
        loadSelectedChapter(false); 
        const savedWordIdx = localStorage.getItem('bom_word_index');
        if (savedWordIdx && !isNaN(parseInt(savedWordIdx))) {
            STATE.wordIndex = parseInt(savedWordIdx);
            if (STATE.wordIndex >= STATE.words.length) STATE.wordIndex = 0;
            updateProgress();
        }
    } else {
        elements.chapterSelect.value = "training";
        loadSelectedChapter();
    }
}

function setupEventListeners() {
    elements.slider.addEventListener('input', (e) => {
        STATE.targetWPM = parseInt(e.target.value);
        elements.sliderLabel.innerText = `${STATE.targetWPM} WPM`;
        localStorage.setItem('bom_wpm', STATE.targetWPM);
    });
    elements.chapterSelect.addEventListener('change', () => loadSelectedChapter(true));
    elements.actionBtn.addEventListener('click', toggleReader);
    elements.themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('bom_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });
    elements.infoBtn.addEventListener('click', () => elements.modal.style.display = "block");
    elements.closeModal.addEventListener('click', () => elements.modal.style.display = "none");
    window.addEventListener('click', (e) => { if (e.target === elements.modal) elements.modal.style.display = "none"; });

    let lastTap = 0;
    elements.displayWrapper.addEventListener('click', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        const rect = elements.displayWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const isLeft = x < (rect.width * 0.35);

        if (tapLength < 300 && tapLength > 0 && isLeft) {
            e.preventDefault(); rewind(10);
            elements.display.innerHTML = "<div style='text-align:center;'>⏪ 10s</div>";
            setTimeout(() => { if (!STATE.isPlaying && STATE.words.length > 0) updateDisplayVisuals(); }, 500);
        } else {
            toggleReader();
        }
        lastTap = currentTime;
    });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        switch(e.code) {
            case 'Space': e.preventDefault(); toggleReader(); break;
            case 'ArrowLeft': e.preventDefault(); STATE.isPlaying ? rewind(10) : rewind(1); break;
            case 'ArrowRight': e.preventDefault(); break; 
            case 'ArrowUp': e.preventDefault(); STATE.targetWPM = Math.min(STATE.targetWPM + 25, 1000); elements.slider.value = STATE.targetWPM; elements.sliderLabel.innerText = `${STATE.targetWPM} WPM`; break;
            case 'ArrowDown': e.preventDefault(); STATE.targetWPM = Math.max(STATE.targetWPM - 25, 200); elements.slider.value = STATE.targetWPM; elements.sliderLabel.innerText = `${STATE.targetWPM} WPM`; break;
        }
    });
}

async function loadBookData() {
    try {
        const response = await fetch('book-of-mormon.json');
        if (!response.ok) throw new Error("Could not load file");
        const data = await response.json();
        STATE.allChapters = [];
        if (data.books) {
            data.books.forEach(book => {
                book.chapters.forEach(chapter => {
                    chapter.fullTitle = `${book.book} ${chapter.chapter}`;
                    STATE.allChapters.push(chapter);
                });
            });
        }
        populateDropdown();
    } catch (error) { elements.ponderDisplay.innerText = "Error loading JSON data."; }
}

function populateDropdown() {
    elements.chapterSelect.innerHTML = ""; 
    const trainingOption = document.createElement('option');
    trainingOption.value = "training";
    trainingOption.innerText = "🎓 Practice Run: The Science of Speed Reading";
    elements.chapterSelect.appendChild(trainingOption);
    STATE.allChapters.forEach((chapter, index) => {
        const option = document.createElement('option');
        option.value = index; option.innerText = chapter.fullTitle;
        elements.chapterSelect.appendChild(option);
    });
}

function loadSelectedChapter(resetPosition = true) {
    stopReader(); 
    STATE.words = []; STATE.verseMap = [];
    
    if (elements.chapterSelect.value === 'training') {
        STATE.currentGlobalIndex = -1;
        parseChapterData(null, true);
    } else {
        const index = parseInt(elements.chapterSelect.value);
        STATE.currentGlobalIndex = index;
        localStorage.setItem('bom_chapter_index', index);
        parseChapterData(STATE.allChapters[index], false);
    }
    
    if (resetPosition) {
        STATE.wordIndex = 0;
        localStorage.setItem('bom_word_index', 0);
        elements.wpmRealtime.innerText = "0 wpm";
        // Reset UI: Show context, hide word, clear ghosts
        elements.display.style.display = "none";
        elements.ponderDisplay.style.display = "block";
        elements.ghostLeft.innerText = "";
        elements.ghostRight.innerText = "";
    }
    updateProgress();
}

function parseChapterData(chapterObj, isTraining) {
    if (isTraining) {
        const words = TRAINING_TEXT.split(/\s+/).filter(w => w.length > 0);
        words.forEach(w => {
            STATE.words.push(w);
            STATE.verseMap.push({ ref: "Training", text: TRAINING_TEXT });
        });
        return;
    }
    if (chapterObj.verses && Array.isArray(chapterObj.verses)) {
        chapterObj.verses.forEach(verse => {
            const vWords = (verse.text || verse.reference).split(/\s+/).filter(w => w.length > 0);
            vWords.forEach(w => {
                STATE.words.push(w);
                STATE.verseMap.push({ ref: verse.reference, text: verse.text || verse.reference });
            });
        });
    } else {
        const text = chapterObj.text || chapterObj.reference || "";
        const words = text.split(/\s+/).filter(w => w.length > 0);
        words.forEach(w => {
            STATE.words.push(w);
            STATE.verseMap.push({ ref: chapterObj.fullTitle, text: text });
        });
    }
}

function toggleReader() { if (STATE.isPlaying) stopReader(); else startReader(); }

// --- FIXED: Now accepts preserveFlow to maintain speed ---
function startReader(preserveFlow = false) {
    if (STATE.words.length === 0) return;
    if (!STATE.isPlaying) {
        STATE.sessionStart = Date.now();
        STATE.chaptersRead = 0;
        if (elements.goalSelect) STATE.currentGoal = elements.goalSelect.value;
    }

    // ONLY reset WPM if we are NOT preserving flow
    if (!preserveFlow) {
        STATE.currentWPM = 200; 
    }
    
    STATE.isPlaying = true;
    elements.actionBtn.innerText = "Pause";
    
    elements.display.style.display = "block";
    elements.ponderDisplay.style.display = "none";
    
    clearTimeout(STATE.zenTimer);
    document.body.classList.remove('zen-active');

    // If preserving flow, enter Zen Mode INSTANTLY
    if (preserveFlow) {
        document.body.classList.add('zen-active');
    } else {
        STATE.zenTimer = setTimeout(() => { if (STATE.isPlaying) document.body.classList.add('zen-active'); }, 10000); 
    }

    // Non-blocking wake lock request
    requestWakeLock();
    readLoop();
}

function stopReader() {
    clearTimeout(STATE.timerId);
    clearTimeout(STATE.zenTimer);
    document.body.classList.remove('zen-active');
    STATE.isPlaying = false;
    elements.actionBtn.innerText = "Resume";
    if (STATE.wakeLock) STATE.wakeLock.release().then(() => STATE.wakeLock = null);
    if (elements.chapterSelect.value !== 'training') localStorage.setItem('bom_word_index', STATE.wordIndex);
    
    if (STATE.words.length > 0 && STATE.wordIndex < STATE.words.length) {
        const currentData = STATE.verseMap[STATE.wordIndex];
        if (currentData) {
            elements.display.style.display = "none";
            elements.ponderDisplay.style.display = "block";
            elements.ponderDisplay.innerText = currentData.text;
        }
    }
}

function readLoop() {
    if (!STATE.isPlaying) return;
    
    if (!STATE.words || STATE.words.length === 0) { stopReader(); return; }

    // Goals & Limits
    if (STATE.currentGoal && STATE.currentGoal !== 'none' && STATE.currentGoal.startsWith('time')) {
        const parts = STATE.currentGoal.split('-');
        if (parts.length > 1) {
            const limit = parseInt(parts[1]);
            if (!isNaN(limit) && (Date.now() - STATE.sessionStart) / 60000 >= limit) { 
                stopReader(); alert(`🎉 Goal reached!`); return; 
            }
        }
    }
    
    // End of Chapter
    if (STATE.wordIndex >= STATE.words.length) {
        STATE.chaptersRead++;
        updateProgress(true); 
        if (elements.chapterSelect.value === 'training') {
            stopReader(); alert("Training Complete!"); elements.chapterSelect.value = "0"; loadSelectedChapter(true); return;
        }
        if (STATE.currentGoal && STATE.currentGoal.startsWith('chap')) {
            const limit = parseInt(STATE.currentGoal.split('-')[1]);
            if (!isNaN(limit) && STATE.chaptersRead >= limit) { stopReader(); alert(`🎉 Goal reached!`); return; }
        }
        
        // --- FIXED: Pass true to startReader to KEEP THE FLOW ---
        if (STATE.currentGlobalIndex < STATE.allChapters.length - 1) {
            elements.chapterSelect.value = STATE.currentGlobalIndex + 1; 
            loadSelectedChapter(true); 
            startReader(true); // <--- THIS KEEPS WPM & ZEN
            return;
        } else {
            stopReader(); elements.ponderDisplay.innerText = "Book Completed!"; return;
        }
    }

    updateDisplayVisuals();
    STATE.wordIndex++;
    updateProgress();

    // Ramping Logic
    if (STATE.currentWPM < STATE.targetWPM) {
        if (STATE.wordIndex < 20) STATE.currentWPM = 250;
        else if (STATE.wordIndex < 50) STATE.currentWPM = 350;
        else STATE.currentWPM += 5; 
    }
    if (isNaN(STATE.currentWPM) || STATE.currentWPM < 50) STATE.currentWPM = 200;
    if (STATE.currentWPM > STATE.targetWPM) STATE.currentWPM = STATE.targetWPM;

    // Delay Calculation
    let delay = 60000 / STATE.currentWPM;
    const prevIndex = STATE.wordIndex - 1;
    if (prevIndex >= 0 && prevIndex < STATE.words.length) {
        const word = STATE.words[prevIndex];
        if (word && typeof word === 'string') {
            if (word.endsWith('.')) delay *= 3.5;      
            else if (word.endsWith('?')) delay *= 3.5; 
            else if (word.endsWith('!')) delay *= 3.5; 
            else if (word.endsWith(',') || word.endsWith(';')) delay *= 2.0; 
            else if (word.length > 12) delay *= 1.3;   
        }
    }

    STATE.timerId = setTimeout(readLoop, delay);
}

function updateDisplayVisuals() {
    if (STATE.wordIndex >= STATE.words.length) return;
    const word = STATE.words[STATE.wordIndex];
    if (word) elements.display.innerHTML = getOrpHtml(word);
    
    const leftWord = (STATE.wordIndex > 0) ? STATE.words[STATE.wordIndex - 1] : "";
    elements.ghostLeft.innerText = leftWord || "";
    
    const rightWord = (STATE.wordIndex < STATE.words.length - 1) ? STATE.words[STATE.wordIndex + 1] : "";
    elements.ghostRight.innerText = rightWord || "";

    elements.wpmRealtime.innerText = `${Math.floor(STATE.currentWPM)} wpm`;
    
    const data = STATE.verseMap[STATE.wordIndex];
    if (data) elements.refDisplay.innerText = data.ref;
}

// --- RESTORED MISSING FUNCTION ---
function updateProgress(forceComplete = false) {
    if (elements.chapterSelect.value === 'training') {
        const percent = (STATE.wordIndex / STATE.words.length) * 100;
        if (elements.token) elements.token.style.left = `${percent}%`;
        if (elements.progressText) elements.progressText.innerText = "Training Mode";
        return;
    }

    const totalChapters = STATE.allChapters.length;
    if (!totalChapters || totalChapters === 0) return;

    let percent = (STATE.currentGlobalIndex / totalChapters) * 100;
    const chapterWeight = 1 / totalChapters * 100; 
    let wordProgress = 0;
    if (STATE.words.length > 0) wordProgress = (STATE.wordIndex / STATE.words.length) * chapterWeight;
    if (forceComplete) wordProgress = chapterWeight;
    const totalPercent = percent + wordProgress;

    if (elements.token) elements.token.style.left = `${totalPercent}%`;
    if (elements.progressText) elements.progressText.innerText = `${totalPercent.toFixed(2)}% Completed`;
    
    if (STATE.wordIndex % 50 === 0) localStorage.setItem('bom_word_index', STATE.wordIndex);
}

function rewind(seconds = 10) {
    const wordsBack = Math.floor((STATE.currentWPM / 60) * seconds);
    STATE.wordIndex -= wordsBack;
    if (STATE.wordIndex < 0) STATE.wordIndex = 0;
    updateDisplayVisuals(); updateProgress();
}

function getOrpHtml(word) {
    if (!word) return "";
    const orpIndex = Math.ceil((word.length - 1) * 0.35);
    const leftPart = word.substring(0, orpIndex);
    const orpLetter = word.charAt(orpIndex);
    const rightPart = word.substring(orpIndex + 1);
    return `<div class="rsvp-grid"><span class="rsvp-left">${leftPart}</span><span class="orp-letter">${orpLetter}</span><span class="rsvp-right">${rightPart}</span></div>`;
}

async function requestWakeLock() {
    if ('wakeLock' in navigator) { 
        try { STATE.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { console.log("Wake Lock skipped"); } 
    }
}