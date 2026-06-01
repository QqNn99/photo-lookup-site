const uploadForm = document.querySelector("#uploadForm");
const passwordInput = document.querySelector("#password");
const statusEl = document.querySelector("#adminStatus");
const photoList = document.querySelector("#photoList");
const refreshButton = document.querySelector("#refresh");
const termsInput = document.querySelector("#terms");
const photoInput = document.querySelector("#photo");

const maxImageSide = 1600;
const jpegQuality = 0.82;

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

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败"));
    image.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("图片压缩失败"));
    }, type, quality);
  });
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;

  const image = await readImage(file);
  const scale = Math.min(1, maxImageSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(image.src);

  const blob = await canvasToBlob(canvas, "image/jpeg", jpegQuality);
  if (blob.size >= file.size && file.size <= 2 * 1024 * 1024) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now()
  });
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

async function compressFiles(files) {
  const compressedFiles = [];
  let originalBytes = 0;
  let compressedBytes = 0;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    statusEl.textContent = `正在压缩第 ${index + 1} / ${files.length} 张照片...`;
    const compressed = await compressImage(file);
    compressedFiles.push(compressed);
    originalBytes += file.size;
    compressedBytes += compressed.size;
  }

  return { compressedFiles, originalBytes, compressedBytes };
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const originalFiles = Array.from(photoInput.files);
  if (originalFiles.length === 0) {
    statusEl.textContent = "请至少选择一张照片。";
    return;
  }

  try {
    const { compressedFiles, originalBytes, compressedBytes } = await compressFiles(originalFiles);
    const formData = new FormData();
    formData.append("password", password());
    formData.append("terms", termsInput.value);
    for (const file of compressedFiles) {
      formData.append("photos", file);
    }

    statusEl.textContent = `正在上传 ${compressedFiles.length} 张照片，${formatBytes(originalBytes)} -> ${formatBytes(compressedBytes)}。`;

    const data = await api("/api/photos", {
      method: "POST",
      body: formData,
      headers: {}
    });

    termsInput.value = "";
    photoInput.value = "";
    statusEl.textContent = `上传成功，共 ${data.photos?.length || compressedFiles.length} 张。`;
    loadPhotos();
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

refreshButton.addEventListener("click", loadPhotos);
