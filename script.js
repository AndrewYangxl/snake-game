const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("highScore");
const speedLabel = document.getElementById("speedLabel");
const overlay = document.getElementById("overlay");
const overlayKicker = document.getElementById("overlayKicker");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const primaryButton = document.getElementById("primaryButton");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const speedSelect = document.getElementById("speedSelect");
const soundButton = document.getElementById("soundButton");

const GRID_SIZE = 24;
const CELL_SIZE = canvas.width / GRID_SIZE;
const SPEED_NAMES = { 150: "悠闲", 105: "标准", 72: "极速" };
const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let snake;
let food;
let direction;
let queuedDirection;
let score;
let timer = null;
let gameState = "ready";
let soundEnabled = true;
let audioContext = null;

function getStoredHighScore() {
  try {
    return Number.parseInt(localStorage.getItem("neonSnakeHighScore") || "0", 10);
  } catch {
    return 0;
  }
}

let highScore = getStoredHighScore();
highScoreElement.textContent = highScore;

function resetGame() {
  snake = [
    { x: 12, y: 12 },
    { x: 11, y: 12 },
    { x: 10, y: 12 },
    { x: 9, y: 12 },
  ];
  direction = DIRECTIONS.right;
  queuedDirection = DIRECTIONS.right;
  score = 0;
  scoreElement.textContent = score;
  pauseButton.textContent = "暂停";
  placeFood();
  draw();
}

function startGame() {
  if (gameState === "gameover" || gameState === "ready") {
    resetGame();
  }
  gameState = "playing";
  overlay.classList.add("hidden");
  restartTimer();
}

function restartGame() {
  stopTimer();
  resetGame();
  gameState = "playing";
  overlay.classList.add("hidden");
  restartTimer();
}

function togglePause() {
  if (gameState === "ready" || gameState === "gameover") {
    startGame();
    return;
  }

  if (gameState === "playing") {
    gameState = "paused";
    stopTimer();
    pauseButton.textContent = "继续";
    showOverlay("游戏暂停", "休息一下", "按空格或按钮继续", "继续游戏");
  } else {
    gameState = "playing";
    pauseButton.textContent = "暂停";
    overlay.classList.add("hidden");
    restartTimer();
  }
}

function restartTimer() {
  stopTimer();
  timer = window.setInterval(tick, Number(speedSelect.value));
}

function stopTimer() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

function tick() {
  direction = queuedDirection;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  const hitWall = head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE;
  const ateFood = head.x === food.x && head.y === food.y;
  const bodyToCheck = ateFood ? snake : snake.slice(0, -1);
  const hitSelf = bodyToCheck.some((segment) => segment.x === head.x && segment.y === head.y);

  if (hitWall || hitSelf) {
    endGame();
    return;
  }

  snake.unshift(head);
  if (ateFood) {
    score += 10;
    scoreElement.textContent = score;
    pulseScore();
    playTone(520, 0.07);
    updateHighScore();
    placeFood();
  } else {
    snake.pop();
  }
  draw();
}

function endGame() {
  stopTimer();
  gameState = "gameover";
  playTone(130, 0.22);
  updateHighScore();
  showOverlay("挑战结束", `得分 ${score}`, "再来一次，刷新你的纪录", "重新挑战");
}

function updateHighScore() {
  if (score <= highScore) return;
  highScore = score;
  highScoreElement.textContent = highScore;
  try {
    localStorage.setItem("neonSnakeHighScore", String(highScore));
  } catch {
    // Local storage can be disabled; the game remains fully playable.
  }
}

function placeFood() {
  const emptyCells = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!snake.some((segment) => segment.x === x && segment.y === y)) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length === 0) {
    endGame();
    return;
  }
  food = emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawFood();
  drawSnake();
}

function drawBoard() {
  ctx.fillStyle = "#080c09";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(166, 255, 99, 0.045)";
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID_SIZE; i += 1) {
    const position = i * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(position, 0);
    ctx.lineTo(position, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, position);
    ctx.lineTo(canvas.width, position);
    ctx.stroke();
  }
}

function drawSnake() {
  snake.forEach((segment, index) => {
    const inset = index === 0 ? 2 : 3.5;
    const gradient = ctx.createLinearGradient(
      segment.x * CELL_SIZE,
      segment.y * CELL_SIZE,
      (segment.x + 1) * CELL_SIZE,
      (segment.y + 1) * CELL_SIZE,
    );
    gradient.addColorStop(0, index === 0 ? "#e2ffca" : "#a6ff63");
    gradient.addColorStop(1, index === 0 ? "#8eff48" : "#4fd62f");
    ctx.fillStyle = gradient;
    roundRect(
      segment.x * CELL_SIZE + inset,
      segment.y * CELL_SIZE + inset,
      CELL_SIZE - inset * 2,
      CELL_SIZE - inset * 2,
      index === 0 ? 8 : 7,
    );

    if (index === 0) drawEyes(segment);
  });
}

function drawEyes(head) {
  const centerX = head.x * CELL_SIZE + CELL_SIZE / 2;
  const centerY = head.y * CELL_SIZE + CELL_SIZE / 2;
  const sideX = direction.y !== 0 ? 5 : direction.x * 4;
  const sideY = direction.x !== 0 ? 5 : direction.y * 4;
  const frontX = direction.x * 5;
  const frontY = direction.y * 5;
  ctx.fillStyle = "#10200c";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(centerX + frontX + sideX * side, centerY + frontY + sideY * side, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFood() {
  if (!food) return;
  const x = food.x * CELL_SIZE + CELL_SIZE / 2;
  const y = food.y * CELL_SIZE + CELL_SIZE / 2;
  ctx.save();
  ctx.shadowColor = "rgba(255, 107, 104, 0.8)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ff6b68";
  ctx.beginPath();
  ctx.arc(x, y + 1, CELL_SIZE * 0.29, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#a6ff63";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.quadraticCurveTo(x + 5, y - 12, x + 9, y - 9);
  ctx.stroke();
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function requestDirection(nextDirection) {
  if (gameState === "ready") startGame();
  if (gameState !== "playing") return;
  const isOpposite = nextDirection.x + direction.x === 0 && nextDirection.y + direction.y === 0;
  if (!isOpposite) queuedDirection = nextDirection;
}

function showOverlay(kicker, title, text, buttonText) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  primaryButton.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function pulseScore() {
  scoreElement.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.28)", color: "#ffffff" },
      { transform: "scale(1)" },
    ],
    { duration: 240, easing: "ease-out" },
  );
}

function playTone(frequency, duration) {
  if (!soundEnabled) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.06, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // Audio support is optional.
  }
}

document.addEventListener("keydown", (event) => {
  const keyMap = {
    ArrowUp: DIRECTIONS.up,
    w: DIRECTIONS.up,
    W: DIRECTIONS.up,
    ArrowDown: DIRECTIONS.down,
    s: DIRECTIONS.down,
    S: DIRECTIONS.down,
    ArrowLeft: DIRECTIONS.left,
    a: DIRECTIONS.left,
    A: DIRECTIONS.left,
    ArrowRight: DIRECTIONS.right,
    d: DIRECTIONS.right,
    D: DIRECTIONS.right,
  };

  if (event.key in keyMap) {
    event.preventDefault();
    requestDirection(keyMap[event.key]);
  } else if (event.code === "Space") {
    event.preventDefault();
    togglePause();
  }
});

document.querySelectorAll("[data-direction]").forEach((button) => {
  button.addEventListener("pointerdown", () => requestDirection(DIRECTIONS[button.dataset.direction]));
});

primaryButton.addEventListener("click", () => {
  if (gameState === "paused") togglePause();
  else startGame();
});
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", restartGame);
speedSelect.addEventListener("change", () => {
  speedLabel.textContent = SPEED_NAMES[speedSelect.value];
  if (gameState === "playing") restartTimer();
});
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.classList.toggle("muted", !soundEnabled);
  soundButton.setAttribute("aria-pressed", String(!soundEnabled));
});

speedLabel.textContent = SPEED_NAMES[speedSelect.value];
resetGame();
