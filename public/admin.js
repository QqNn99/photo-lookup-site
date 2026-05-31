const uploadForm = document.querySelector("#uploadForm");
const passwordInput = document.querySelector("#password");
const statusEl = document.querySelector("#adminStatus");
const photoList = document.querySelector("#photoList");
const refreshButton = document.querySelector("#refresh");

function password() {
  return passwordInput.value;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "x-admin-password": password(),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function renderPhotos(photos) {
  photoList.innerHTML = "";

  if (photos.length === 0) {
    photoList.innerHTML = `<p class="empty">还没有上传照片。</p>`;
    return;
  }

  for (const item of photos) {
    const row = document.createElement("article");
    row.className = "admin-photo-row";
    row.innerHTML = `
      <img src="${item.url}" alt="${item.terms.join(", ")}" />
      <div>
        <strong>${item.terms[0]}</strong>
        <span>${item.terms.join("、")}</span>
      </div>
      <button class="danger" type="button">删除</button>
    `;
    row.querySelector("button").addEventListener("click", async () => {
      try {
        await api(`/api/photos/${item.id}`, { method: "DELETE" });
        statusEl.textContent = "已删除。";
        loadPhotos();
      } catch (error) {
        statusEl.textContent = error.message;
      }
    });
    photoList.appendChild(row);
  }
}

async function loadPhotos() {
  if (!password()) {
    statusEl.textContent = "输入管理员密码后可以查看已上传照片。";
    return;
  }

  try {
    const data = await api("/api/photos");
    renderPhotos(data.photos || []);
    statusEl.textContent = "已加载。";
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);
  statusEl.textContent = "上传中...";

  try {
    await api("/api/photos", {
      method: "POST",
      body: formData,
      headers: {}
    });
    document.querySelector("#terms").value = "";
    document.querySelector("#photo").value = "";
    statusEl.textContent = "上传成功。";
    loadPhotos();
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

refreshButton.addEventListener("click", loadPhotos);
