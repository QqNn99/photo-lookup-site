const form = document.querySelector("#searchForm");
const queryInput = document.querySelector("#query");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");

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
    statusEl.textContent = "请输入一个名词。";
    resultsEl.innerHTML = "";
    return;
  }

  statusEl.textContent = "查询中...";
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  renderResults(data.results || []);
});
