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
    formData.append("photos", new Blob([png], { type: "image/png" }), "apple-1.png");
    formData.append("photos", new Blob([png], { type: "image/png" }), "apple-2.png");

    const uploaded = await request(baseUrl, "/api/photos", {
      method: "POST",
      headers: { "x-admin-password": "admin123" },
      body: formData
    });
    if (uploaded.status !== 201) throw new Error(`upload status ${uploaded.status}: ${await uploaded.text()}`);

    const uploadData = await uploaded.json();
    const search = await request(baseUrl, "/api/search?q=%E8%8B%B9%E6%9E%9C");
    const searchData = await search.json();
    const uploadedIds = uploadData.photos.map((photo) => photo.id);
    const matchedCount = searchData.results.filter((item) => uploadedIds.includes(item.id)).length;
    if (matchedCount !== 2) {
      throw new Error(`search returned ${matchedCount} uploaded photos instead of 2`);
    }

    for (const photo of uploadData.photos) {
      const removed = await request(baseUrl, `/api/photos/${photo.id}`, {
        method: "DELETE",
        headers: { "x-admin-password": "admin123" }
      });
      if (removed.status !== 200) throw new Error(`delete status ${removed.status}`);

      const filePath = path.join(uploadsDir, path.basename(photo.url));
      if (fs.existsSync(filePath)) throw new Error("uploaded file was not deleted");
    }

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
