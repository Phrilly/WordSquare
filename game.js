const gridSize = 5;
let cells = Array(gridSize * gridSize).fill("");
let wildcardState = Array(gridSize * gridSize).fill(false);
let placedCount = 0;
let pendingCellIndex = null;
let explodedWords = new Set();
let currentScore = 0;
let isCurrentGameDaily = true;
let usedWildcards = new Set();
let gameDictionary = new Set();
let gameDeck = [];
let bestDailyData = null;
let aiBestScore = 0;
let aiBestGrid = null;
let dailyOffset = 0;
let dailySeed = 0;

const gridEl = document.getElementById("grid");
const headerLabelEl = document.getElementById("header-label");
const nextLetterEl = document.getElementById("next-letter");
const scoreEl = document.getElementById("score");
const alphabetModal = document.getElementById("alphabet-modal");
const leftHeaderEl = document.getElementById("left-header");
const highscoreEntryModal = document.getElementById("highscore-entry-modal");
const leaderboardModal = document.getElementById("leaderboard-modal");
const initialsInput = document.getElementById("hidden-initials");
const topBarEl = document.querySelector(".top-bar");

initialsInput.addEventListener("input", (e) => {
  const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
  e.target.value = val;
  document.getElementById("init-tile-1").innerText = val[0] || "";
  document.getElementById("init-tile-2").innerText = val[1] || "";
  document.getElementById("init-tile-3").innerText = val[2] || "";
});

function getDailySeed() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  let s = 0;
  for (let i = 0; i < dateStr.length; i++) s += dateStr.charCodeAt(i) * (i + 1);
  return s + dailyOffset + 12345;
}

function cycleDailyBoard() {
  dailyOffset++;
  initGame();
}

function resetDailyOffset() {
  dailyOffset = 0;
  initGame();
}

function getSeededRandom() {
  let t = dailySeed += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function generateBagSequence() {
  const rng = isCurrentGameDaily ? getSeededRandom : Math.random;
  const masterBagString = "AAAAAAAEEEEEEEEEEIIIIIOOOOOUUUSSSSRRRRRRRRTTTTTTTTNNNNNNNLLLLLLDDDDDBBCCCCFFGGGHHHJKMMMMPPPQVVWWXYYZ";
  const initialBag = masterBagString.split("");
  const vowels = ["A", "E", "I", "O", "U"];
  let sequence = [];
  let isValid = false;

  while (!isValid) {
    sequence = [];
    const tempBag = [...initialBag];
    let vowelCount = 0;
    let sCount = 0;

    for (let i = 0; i < 25; i++) {
      const index = Math.floor(rng() * tempBag.length);
      const selected = tempBag.splice(index, 1)[0];
      sequence.push(selected);
      if (vowels.includes(selected)) vowelCount++;
      if (selected === "S") sCount++;
    }

    if (vowelCount >= 6 && vowelCount <= 9 && sCount <= 2) isValid = true;
  }

  const wcRoll = rng() * 100;
  let wcCount = 0;
  if (wcRoll < 5) wcCount = 0;
  else if (wcRoll < 30) wcCount = 1;
  else if (wcRoll < 70) wcCount = 2;
  else if (wcRoll < 95) wcCount = 3;
  else wcCount = 4;

  const safeIndices = [];
  for (let i = 0; i < 25; i++) {
    if (sequence[i] !== "S" && sequence[i] !== "Q") safeIndices.push(i);
  }

  for (let i = 0; i < wcCount && safeIndices.length > 0; i++) {
    const randSafeIdx = Math.floor(rng() * safeIndices.length);
    const replaceIdx = safeIndices.splice(randSafeIdx, 1)[0];
    sequence[replaceIdx] = "?";
  }

  return sequence;
}

async function checkYesterdaysWinner() {
  try {
    const res = await fetch("validate.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_yesterdays_winner" })
    });
    const data = await res.json();
    if (!data.winner_initials) return;

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor = "rgba(15, 35, 60, 0.9)";
    overlay.style.zIndex = "9998";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";

    const title = document.createElement("h1");
    title.innerText = "YESTERDAY'S CHAMPION";
    title.style.color = "var(--highlight)";
    title.style.marginBottom = "20px";

    const initialsBox = document.createElement("div");
    initialsBox.innerText = data.winner_initials;
    initialsBox.style.fontSize = "80px";
    initialsBox.style.fontWeight = "bold";
    initialsBox.style.color = "#FFD700";
    initialsBox.style.textShadow = "0 0 20px #ffaa00";

    overlay.appendChild(title);
    overlay.appendChild(initialsBox);
    document.body.appendChild(overlay);
    triggerExplosion(true);

    setTimeout(() => {
      overlay.style.transition = "opacity 1s";
      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 1000);
    }, 4000);
  } catch (e) {
    console.error("Could not fetch yesterday's winner", e);
  }
}
