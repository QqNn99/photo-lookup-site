const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const port = Number(process.env.PORT || 3000);
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const storageRoot = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : rootDir;
const dataDir = path.join(storageRoot, "data");
const uploadsDir = path.join(storageRoot, "uploads");
const dbPath = path.join(dataDir, "photos.json");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp"
};

function loadPhotos() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return [];
  }
}

function savePhotos(photos) {
  fs.writeFileSync(dbPath, JSON.stringify(photos, null, 2));
}

function normalizeTerm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function isAdmin(req) {
  return req.headers["x-admin-password"] === adminPassword;
}

function safePath(baseDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.resolve(baseDir, `.${path.sep}${normalized}`);
  const relativePath = path.relative(baseDir, filePath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath) ? filePath : null;
}

function serveFile(res, baseDir, requestPath) {
  const targetPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = safePath(baseDir, targetPath);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "content-type": mimeTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req, maxBytes = 80 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("上传内容太大，请一次少选几张照片"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(buffer, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) throw new Error("上传格式不正确");

  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const fields = {};
  const files = [];
  let offset = 0;

  while (offset < buffer.length) {
    const boundaryStart = buffer.indexOf(boundary, offset);
    if (boundaryStart === -1) break;

    const partStart = boundaryStart + boundary.length;
    if (buffer.slice(partStart, partStart + 2).toString() === "--") break;

    const headersStart = partStart + 2;
    const headersEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), headersStart);
    if (headersEnd === -1) break;

    const headers = buffer.slice(headersStart, headersEnd).toString("utf8");
    const dataStart = headersEnd + 4;
    const nextBoundary = buffer.indexOf(boundary, dataStart);
    if (nextBoundary === -1) break;

    const dataEnd = nextBoundary - 2;
    const data = buffer.slice(dataStart, Math.max(dataStart, dataEnd));
    const name = headers.match(/name="([^"]+)"/i)?.[1];
    const filename = headers.match(/filename="([^"]*)"/i)?.[1];
    const type = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "";

    if (name && filename) {
      files.push({ field: name, filename, type, data });
    } else if (name) {
      fields[name] = data.toString("utf8");
    }

    offset = nextBoundary;
  }

  return { fields, files };
}

function imageExtension(filename, type) {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return ext;
  if (type === "image/png") return ".png";
  if (type === "image/gif") return ".gif";
  if (type === "image/webp") return ".webp";
  return ".jpg";
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/search") {
    const q = normalizeTerm(url.searchParams.get("q"));
    if (!q) return sendJson(res, 200, { results: [] });

    const results = loadPhotos().filter((item) => {
      const terms = item.terms.map(normalizeTerm);
      return terms.some((term) => term === q || term.includes(q) || q.includes(term));
    });

    return sendJson(res, 200, { results });
  }

  if (req.method === "GET" && url.pathname === "/api/photos") {
    if (!isAdmin(req)) return sendError(res, 401, "管理员密码不正确");
    return sendJson(res, 200, { photos: loadPhotos() });
  }

  if (req.method === "POST" && url.pathname === "/api/photos") {
    if (!isAdmin(req)) return sendError(res, 401, "管理员密码不正确");

    const body = await readBody(req);
    const { fields, files } = parseMultipart(body, req.headers["content-type"] || "");
    const terms = String(fields.terms || "")
      .split(/[,\n，、]/)
      .map((term) => term.trim())
      .filter(Boolean);

    if (terms.length === 0) return sendError(res, 400, "请至少输入一个名词");
    if (files.length === 0) return sendError(res, 400, "请至少选择一张照片");
    if (files.some((file) => !file.type.startsWith("image/"))) {
      return sendError(res, 400, "只能上传图片文件");
    }

    const existingPhotos = loadPhotos();
    const savedPhotos = files.map((file) => {
      const filename = `${Date.now()}-${crypto.randomUUID()}${imageExtension(file.filename, file.type)}`;
      fs.writeFileSync(path.join(uploadsDir, filename), file.data);

      return {
        id: crypto.randomUUID(),
        terms,
        url: `/uploads/${filename}`,
        originalName: file.filename,
        createdAt: new Date().toISOString()
      };
    });

    savePhotos([...savedPhotos, ...existingPhotos]);
    return sendJson(res, 201, { photos: savedPhotos, photo: savedPhotos[0] });
  }

  const deleteMatch = url.pathname.match(/^\/api\/photos\/([a-f0-9-]+)$/i);
  if (req.method === "DELETE" && deleteMatch) {
    if (!isAdmin(req)) return sendError(res, 401, "管理员密码不正确");

    const photos = loadPhotos();
    const photo = photos.find((item) => item.id === deleteMatch[1]);
    if (!photo) return sendError(res, 404, "没有找到这张照片");

    savePhotos(photos.filter((item) => item.id !== photo.id));

    const filename = path.basename(photo.url);
    const filePath = path.join(uploadsDir, filename);
    if (filePath.startsWith(uploadsDir) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return sendJson(res, 200, { ok: true });
  }

  sendError(res, 404, "接口不存在");
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
      if (url.pathname.startsWith("/uploads/")) return serveFile(res, uploadsDir, url.pathname.replace("/uploads", ""));
      serveFile(res, publicDir, url.pathname);
    } catch (error) {
      if (!res.headersSent) sendError(res, 400, error.message || "请求失败");
    }
  });
}

if (require.main === module) {
  createServer().listen(port, () => {
    console.log(`Photo lookup site running at http://localhost:${port}`);
  });
}

module.exports = { createServer };
