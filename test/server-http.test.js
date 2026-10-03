const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const { server } = require("../server.js");

let port;

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// Send a raw request so the test can control the exact bytes on the wire,
// including values that a URL-aware client would refuse to emit.
function rawRequest(lines) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1", () => {
      socket.write(`${lines.join("\r\n")}\r\n\r\n`);
    });
    let data = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      data += chunk;
    });
    socket.on("end", () => resolve(data));
    socket.on("error", reject);
  });
}

async function healthy() {
  const response = await fetch(`http://127.0.0.1:${port}/healthz`);
  return response.status === 200 && (await response.text()) === "ok";
}

test("malformed percent-encoding in a static path returns 400 instead of crashing", async () => {
  const response = await rawRequest([
    "GET /%E0%A4%A HTTP/1.1",
    "Host: localhost",
    "Connection: close"
  ]);
  assert.match(response, /^HTTP\/1\.1 400 /);
  assert.equal(await healthy(), true);
});

test("a NUL byte in a static path returns 400 instead of crashing", async () => {
  const response = await rawRequest([
    "GET /%00 HTTP/1.1",
    "Host: localhost",
    "Connection: close"
  ]);
  assert.match(response, /^HTTP\/1\.1 400 /);
  assert.equal(await healthy(), true);
});

test("route coordinates must be exactly two numbers", async () => {
  for (const origin of [",", "1,", ",2", "1,2,3"]) {
    const response = await fetch(`http://127.0.0.1:${port}/api/route?origin=${encodeURIComponent(origin)}&destination=1,2`);
    assert.equal(response.status, 400, origin);
  }
});

// The server never reads the Host header (URLs are parsed against a fixed
// base), so a garbage value is simply ignored rather than crashing the process.
test("unparsable Host header is ignored instead of crashing", async () => {
  const response = await rawRequest([
    "GET /healthz HTTP/1.1",
    "Host: [",
    "Connection: close"
  ]);
  assert.match(response, /^HTTP\/1\.1 200 /);
  assert.equal(await healthy(), true);
});

test("static paths still resolve after the URL guards", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const outside = await fetch(`http://127.0.0.1:${port}/..%2F..%2Fpackage.json`);
  assert.notEqual(outside.status, 200);
});

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port: free } = probe.address();
      probe.close(() => resolve(free));
    });
  });
}

// In Docker node is PID 1, where an unhandled SIGTERM is ignored and
// `docker stop` ends in SIGKILL; the server must exit cleanly on its own.
test("SIGTERM shuts the server down cleanly with exit code 0", async () => {
  const childPort = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, "../server.js")], {
    env: { ...process.env, PORT: String(childPort), DATABASE_URL: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const exited = new Promise((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
  try {
    await new Promise((resolve, reject) => {
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.includes("Birdtrip running")) resolve();
      });
      exited.then(() => reject(new Error(`server exited before listening: ${output}`)));
    });
    // Leave a keep-alive connection open; it must not hold up shutdown.
    const response = await fetch(`http://127.0.0.1:${childPort}/healthz`);
    assert.equal(await response.text(), "ok");

    const started = Date.now();
    child.kill("SIGTERM");
    const result = await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 5000))
    ]);
    assert.deepEqual(result, { code: 0, signal: null });
    assert.ok(Date.now() - started < 5000);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
});
