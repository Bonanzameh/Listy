const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "listy.json");
const PUBLIC_DIR = __dirname;

const clients = new Set();
let state = null;
let writeQueue = Promise.resolve();

function createId() {
  return crypto.randomUUID();
}

function defaultState() {
  const listId = createId();
  return {
    activeListId: listId,
    lists: [
      {
        id: listId,
        name: "Shopping",
        createdAt: new Date().toISOString(),
        items: [
          {
            id: createId(),
            title: "Eggs",
            description: "",
            volume: "6",
            dueDate: "",
            done: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ],
  };
}

async function ensureState() {
  if (state) {
    return state;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const file = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(file);
    state = normalizeState(parsed);
  } catch {
    state = defaultState();
    await persistState();
  }

  return state;
}

function normalizeState(value) {
  if (!value || !Array.isArray(value.lists)) {
    return defaultState();
  }

  value.lists.forEach((list) => {
    list.items = Array.isArray(list.items) ? list.items : [];
  });

  if (!value.activeListId && value.lists[0]) {
    value.activeListId = value.lists[0].id;
  }

  return value;
}

function persistState() {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2));
  });
  return writeQueue;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function broadcastState() {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  clients.forEach((client) => client.write(payload));
}

function findList(listId) {
  return state.lists.find((list) => list.id === listId);
}

async function mutate(res, callback) {
  await ensureState();
  const result = callback();
  await persistState();
  broadcastState();
  sendJson(res, 200, result || state);
}

async function handleApi(req, res, url) {
  await ensureState();

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, state);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify(state)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  const body = await readBody(req);

  if (req.method === "POST" && url.pathname === "/api/lists") {
    await mutate(res, () => {
      const name = String(body.name || "").trim();
      if (!name) {
        throw new HttpError(400, "List name is required");
      }
      const list = { id: createId(), name, createdAt: new Date().toISOString(), items: [] };
      state.lists.push(list);
      state.activeListId = list.id;
      return state;
    });
    return;
  }

  const listMatch = url.pathname.match(/^\/api\/lists\/([^/]+)$/);
  if (listMatch && req.method === "PATCH") {
    await mutate(res, () => {
      const list = findList(listMatch[1]);
      if (!list) {
        throw new HttpError(404, "List not found");
      }
      const name = String(body.name || "").trim();
      if (!name) {
        throw new HttpError(400, "List name is required");
      }
      list.name = name;
      return state;
    });
    return;
  }

  if (listMatch && req.method === "DELETE") {
    await mutate(res, () => {
      state.lists = state.lists.filter((list) => list.id !== listMatch[1]);
      if (state.activeListId === listMatch[1]) {
        state.activeListId = state.lists[0]?.id || null;
      }
      return state;
    });
    return;
  }

  const itemCollectionMatch = url.pathname.match(/^\/api\/lists\/([^/]+)\/items$/);
  if (itemCollectionMatch && req.method === "POST") {
    await mutate(res, () => {
      const list = findList(itemCollectionMatch[1]);
      if (!list) {
        throw new HttpError(404, "List not found");
      }
      const title = String(body.title || "").trim();
      if (!title) {
        throw new HttpError(400, "Item title is required");
      }
      list.items.push({
        id: createId(),
        title,
        description: String(body.description || "").trim(),
        volume: String(body.volume || "").trim(),
        dueDate: String(body.dueDate || ""),
        done: false,
        createdAt: new Date().toISOString(),
      });
      return state;
    });
    return;
  }

  const itemMatch = url.pathname.match(/^\/api\/lists\/([^/]+)\/items\/([^/]+)$/);
  if (itemMatch && req.method === "PATCH") {
    await mutate(res, () => {
      const list = findList(itemMatch[1]);
      const item = list?.items.find((candidate) => candidate.id === itemMatch[2]);
      if (!item) {
        throw new HttpError(404, "Item not found");
      }

      ["title", "description", "volume", "dueDate"].forEach((key) => {
        if (key in body) {
          item[key] = String(body[key] || "").trim();
        }
      });
      if ("done" in body) {
        item.done = Boolean(body.done);
      }
      if (!item.title) {
        item.title = "Untitled item";
      }
      return state;
    });
    return;
  }

  if (itemMatch && req.method === "DELETE") {
    await mutate(res, () => {
      const list = findList(itemMatch[1]);
      if (!list) {
        throw new HttpError(404, "List not found");
      }
      list.items = list.items.filter((item) => item.id !== itemMatch[2]);
      return state;
    });
    return;
  }

  sendError(res, 404, "Not found");
}

async function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "no-store",
    });
    res.end(content);
  } catch {
    const fallback = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
    res.end(fallback);
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath);
  return {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
  }[ext] || "application/octet-stream";
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url);
  } catch (error) {
    if (error instanceof HttpError) {
      sendError(res, error.status, error.message);
      return;
    }
    console.error(error);
    sendError(res, 500, "Server error");
  }
});

ensureState().then(() => {
  server.listen(PORT, () => {
    console.log(`Listy listening on port ${PORT}`);
  });
});
