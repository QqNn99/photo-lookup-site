const form = document.querySelector("#searchForm");
const queryInput = document.querySelector("#query");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");
const bubbleField = document.querySelector("#bubbleField");

const pointer = {
  x: -9999,
  y: -9999,
  active: false
};

function createBubbleScene() {
  if (!bubbleField || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const bubbleCount = window.innerWidth < 760 ? 30 : 58;
  const bubbles = [];
  const fragment = document.createDocumentFragment();
  const edgePadding = 180;

  for (let index = 0; index < bubbleCount; index += 1) {
    const element = document.createElement("span");
    const size = 28 + Math.random() * 122;
    const bubble = {
      element,
      x: -edgePadding + Math.random() * (window.innerWidth + edgePadding * 2),
      y: -edgePadding + Math.random() * (window.innerHeight + edgePadding * 2),
      vx: (Math.random() - 0.5) * 0.34,
      vy: -0.1 - Math.random() * 0.24,
      drift: Math.random() * Math.PI * 2,
      size,
      opacity: 0.26 + Math.random() * 0.26
    };

    element.style.width = `${size}px`;
    element.style.height = `${size}px`;
    element.style.opacity = bubble.opacity;
    fragment.appendChild(element);
    bubbles.push(bubble);
  }

  bubbleField.appendChild(fragment);

  function moveBubble(bubble, time) {
    bubble.drift += 0.006 + bubble.size / 90000;
    bubble.x += bubble.vx + Math.sin(time / 1200 + bubble.drift) * 0.28;
    bubble.y += bubble.vy + Math.cos(time / 1600 + bubble.drift) * 0.08;

    if (pointer.active) {
      const centerX = bubble.x + bubble.size / 2;
      const centerY = bubble.y + bubble.size / 2;
      const dx = centerX - pointer.x;
      const dy = centerY - pointer.y;
      const distance = Math.hypot(dx, dy);
      const forceRadius = 190;

      if (distance < forceRadius) {
        const force = (1 - distance / forceRadius) * 9.5;
        const angle = Math.atan2(dy, dx);
        bubble.x += Math.cos(angle) * force;
        bubble.y += Math.sin(angle) * force;
      }
    }

    if (bubble.y < -edgePadding - bubble.size) {
      bubble.y = window.innerHeight + edgePadding;
      bubble.x = -edgePadding + Math.random() * (window.innerWidth + edgePadding * 2);
    }
    if (bubble.y > window.innerHeight + edgePadding + bubble.size) {
      bubble.y = -edgePadding - bubble.size;
      bubble.x = -edgePadding + Math.random() * (window.innerWidth + edgePadding * 2);
    }
    if (bubble.x < -edgePadding - bubble.size) bubble.x = window.innerWidth + edgePadding;
    if (bubble.x > window.innerWidth + edgePadding + bubble.size) bubble.x = -edgePadding - bubble.size;

    bubble.element.style.transform = `translate3d(${bubble.x}px, ${bubble.y}px, 0)`;
  }

  function animate(time) {
    for (const bubble of bubbles) moveBubble(bubble, time);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
});

window.addEventListener("pointerleave", () => {
  pointer.active = false;
});

window.addEventListener("touchend", () => {
  pointer.active = false;
});

function renderResults(results) {
  resultsEl.innerHTML = "";

  if (results.length === 0) {
    statusEl.textContent = "没有找到对应照片。";
    return;
  }

  statusEl.textContent = `找到 ${results.length} 张照片。`;
  for (const item of results) {
    const card = document.createElement("article");
    card.className = "photo-card";
    card.innerHTML = `
      <img src="${item.url}" alt="${item.terms.join(", ")}" />
      <div class="photo-meta">
        <strong>${item.terms[0]}</strong>
        <span>${item.terms.join("、")}</span>
      </div>
    `;
    resultsEl.appendChild(card);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (!query) {
    statusEl.textContent = "请输入一个关键词。";
    resultsEl.innerHTML = "";
    return;
  }

  statusEl.textContent = "搜索中...";
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  renderResults(data.results || []);
});

createBubbleScene();
