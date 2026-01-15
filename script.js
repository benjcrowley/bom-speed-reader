/* --- CONFIGURATION & STATE --- */
const STATE = {
    words: [],           // Array of words from current chapter
    currentIndex: 0,     // Current word position
    isPlaying: false,    // Is the reader running?
    timerId: null,       // Reference to the setTimeout
    currentWPM: 150,     // Current speed (starts slow)
    targetWPM: 400,      // Desired speed from slider
    wakeLock: null       // Screen wake lock reference
};

/* --- DOM ELEMENTS --- */
const elements = {
    display: document.getElementById('word-display'),
    wpmRealtime: document.getElementById('realtime-wpm'),
    chapterSelect: document.getElementById('chapter-select'),
    slider: document.getElementById('wpm-slider'),
    sliderLabel: document.getElementById('target-wpm-display'),
    actionBtn: document.getElementById('action-btn'),
    themeToggle: document.getElementById('theme-toggle')
};

/* --- INITIALIZATION --- */
document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupEventListeners();
    await loadBookData();
}

function setupEventListeners() {
    // Slider Change
    elements.slider.addEventListener('input', (e) => {
        STATE.targetWPM = parseInt(e.target.value);
        elements.sliderLabel.innerText = `${STATE.targetWPM} WPM`;
    });

    // Chapter Select
    elements.chapterSelect.addEventListener('change', loadSelectedChapter);

    // Start/Stop Button
    elements.actionBtn.addEventListener('click', toggleReader);

    // Theme Toggle
    elements.themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });
}

/* --- DATA LOADING --- */
async function loadBookData() {
    try {
        const response = await fetch('book-of-mormon.json');
        if (!response.ok) throw new Error("Could not load file");
        
        const data = await response.json();
        populateDropdown(data);
    } catch (error) {
        elements.display.innerText = "Error loading book data.";
        console.error(error);
    }
}

function populateDropdown(data) {
    elements.chapterSelect.innerHTML = ""; // Clear loading text
    
    // NOTE: This assumes standard structure: { books: [ { book: "1 Nephi", chapters: [...] } ] }
    if (!data.books) return;

    data.books.forEach((bookObj, bIndex) => {
        bookObj.chapters.forEach((chapterObj, cIndex) => {
            const option = document.createElement('option');
            // Store indices as value "bookIndex,chapterIndex"
            option.value = `${bIndex},${cIndex}`;
            option.innerText = `${bookObj.book} ${chapterObj.chapter}`;
            elements.chapterSelect.appendChild(option);
            
            // Save reference text directly to the DOM element for easy access
            option.dataset.text = chapterObj.reference || chapterObj.text || ""; 
        });
    });

    // Select first chapter automatically
    elements.chapterSelect.selectedIndex = 0;
    loadSelectedChapter();
}

function loadSelectedChapter() {
    stopReader();
    const selectedOption = elements.chapterSelect.options[elements.chapterSelect.selectedIndex];
    if (!selectedOption) return;

    const rawText = selectedOption.dataset.text;
    
    // Clean text: remove extra spaces, split by spaces
    STATE.words = rawText.split(/\s+/).filter(w => w.length > 0);
    STATE.currentIndex = 0;
    
    elements.display.innerText = "Ready";
    elements.wpmRealtime.innerText = "0 wpm";
}

/* --- READER ENGINE --- */
function toggleReader() {
    if (STATE.isPlaying) {
        stopReader();
    } else {
        startReader();
    }
}

async function startReader() {
    if (STATE.words.length === 0) return;

    // Reset speed for ramp-up
    STATE.currentWPM = 150; 
    STATE.isPlaying = true;
    elements.actionBtn.innerText = "Pause";
    
    // Request Wake Lock (Keep screen on)
    requestWakeLock();

    readLoop();
}

function stopReader() {
    clearTimeout(STATE.timerId);
    STATE.isPlaying = false;
    elements.actionBtn.innerText = "Resume";
    
    // Release Wake Lock
    if (STATE.wakeLock) {
        STATE.wakeLock.release().then(() => STATE.wakeLock = null);
    }
}

function readLoop() {
    if (!STATE.isPlaying) return;
    if (STATE.currentIndex >= STATE.words.length) {
        stopReader();
        elements.display.innerText = "Done!";
        return;
    }

    const word = STATE.words[STATE.currentIndex];
    
    // Render Word with ORP
    elements.display.innerHTML = getOrpHtml(word);
    
    // Update WPM display
    elements.wpmRealtime.innerText = `${Math.floor(STATE.currentWPM)} wpm`;

    // Increment Word
    STATE.currentIndex++;

    // --- RAMP UP LOGIC ---
    if (STATE.currentWPM < STATE.targetWPM) {
        STATE.currentWPM += 2; // Increase by 2 WPM per word
    } else if (STATE.currentWPM > STATE.targetWPM) {
        STATE.currentWPM = STATE.targetWPM; // Cap it if slider moved down
    }

    // Calculate Delay
    // Standard delay
    let delay = 60000 / STATE.currentWPM;

    // Micro-pauses for punctuation (Natural Reading Flow)
    if (word.endsWith('.') || word.endsWith(';') || word.endsWith('?')) {
        delay *= 1.5; // 50% longer pause on sentences
    } else if (word.length > 10) {
        delay *= 1.2; // 20% longer on massive words
    }

    STATE.timerId = setTimeout(readLoop, delay);
}

/* --- UTILITIES --- */
// Optimal Recognition Point (ORP) Logic
function getOrpHtml(word) {
    if (!word) return "";
    // Target roughly the 35% mark of the word
    const orpIndex = Math.ceil((word.length - 1) * 0.35);
    
    const start = word.substring(0, orpIndex);
    const middle = word.charAt(orpIndex);
    const end = word.substring(orpIndex + 1);

    return `${start}<span class="orp-letter">${middle}</span>${end}`;
}

// Screen Wake Lock API
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            STATE.wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.log("Wake Lock rejected:", err.name, err.message);
        }
    }
}