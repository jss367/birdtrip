const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");

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
