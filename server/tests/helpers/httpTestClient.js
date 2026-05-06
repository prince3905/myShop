const http = require("http");
const { Duplex } = require("stream");

class MockSocket extends Duplex {
  constructor() {
    super();
    this.remoteAddress = "127.0.0.1";
    this.writable = true;
    this.readable = true;
    this.destroyed = false;
    this.output = [];
  }

  _read() {}

  _write(chunk, encoding, callback) {
    this.output.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    callback();
  }

  write(chunk, encoding, callback) {
    this.output.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    if (typeof callback === "function") callback();
    return true;
  }

  setTimeout() {
    return this;
  }

  setNoDelay() {
    return this;
  }

  setKeepAlive() {
    return this;
  }

  cork() {}

  uncork() {}

  destroy(error) {
    this.destroyed = true;
    if (error) {
      this.emit("error", error);
    }
    return this;
  }
}

const normalizeHeaders = (headers = {}) =>
  Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));

const parseResponseBody = (rawText) => {
  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
};

const invokeApp = (app, { method = "GET", path = "/", headers = {}, body } = {}) =>
  new Promise((resolve, reject) => {
    const socket = new MockSocket();
    const req = new http.IncomingMessage(socket);
    req.method = method.toUpperCase();
    req.url = path;
    req.headers = normalizeHeaders(headers);
    req.connection = socket;
    req.socket = socket;
    req.ip = socket.remoteAddress;
    req.body = body;

    const res = new http.ServerResponse(req);
    res.assignSocket(socket);

    res.on("finish", () => {
      const rawResponse = Buffer.concat(socket.output).toString("utf8");
      const [, rawBody = ""] = rawResponse.split("\r\n\r\n");

      resolve({
        status: res.statusCode,
        headers: typeof res.getHeaders === "function" ? res.getHeaders() : {},
        text: rawBody,
        body: parseResponseBody(rawBody),
      });
    });

    res.on("error", reject);
    socket.on("error", reject);

    app.handle(req, res, reject);
    req.push(null);
  });

const createTestClient = (app) => ({
  get(path, headers = {}) {
    return invokeApp(app, { method: "GET", path, headers });
  },
  post(path, body, headers = {}) {
    return invokeApp(app, { method: "POST", path, headers, body });
  },
});

module.exports = {
  createTestClient,
};
