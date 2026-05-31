const fs = require("fs");
const path = require("path");
const { createServer } = require("./server");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const uploadsDir = path.join(rootDir, "uploads");
const dbPath = path.join(dataDir, "photos.json");

const originalDb = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;

function restore() {
  if (originalDb) {
    fs.writeFileSync(dbPath, originalDb);
  } else if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}

function request(baseUrl, pathName, options) {
  return fetch(`${baseUrl}${pathName}`, options);
}

async function main() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const home = await request(baseUrl, "/");
    if (home.status !== 200) throw new Error(`home status ${home.status}`);

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    );
    const formData = new FormData();
    formData.append("terms", "测试苹果, 苹果");
    formData.append("photo", new Blob([png], { type: "image/png" }), "apple.png");

    const uploaded = await request(baseUrl, "/api/photos", {
      method: "POST",
      headers: { "x-admin-password": "admin123" },
      body: formData
    });
    if (uploaded.status !== 201) throw new Error(`upload status ${uploaded.status}: ${await uploaded.text()}`);

    const uploadData = await uploaded.json();
    const search = await request(baseUrl, "/api/search?q=%E8%8B%B9%E6%9E%9C");
    const searchData = await search.json();
    if (!searchData.results.some((item) => item.id === uploadData.photo.id)) {
      throw new Error("search did not return uploaded photo");
    }

    const removed = await request(baseUrl, `/api/photos/${uploadData.photo.id}`, {
      method: "DELETE",
      headers: { "x-admin-password": "admin123" }
    });
    if (removed.status !== 200) throw new Error(`delete status ${removed.status}`);

    const filePath = path.join(uploadsDir, path.basename(uploadData.photo.url));
    if (fs.existsSync(filePath)) throw new Error("uploaded file was not deleted");

    console.log("Smoke test passed");
  } finally {
    server.close();
    restore();
  }
}

main().catch((error) => {
  restore();
  console.error(error);
  process.exit(1);
});
