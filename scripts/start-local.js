const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

const rootDir = path.resolve(__dirname, "..");
const serverDir = path.join(rootDir, "server");
const clientDir = path.join(rootDir, "client", "babaShop");
const publicDir = path.join(rootDir, "server", "public");
const publicIndex = path.join(publicDir, "index.html");

let shuttingDown = false;
const children = [];

function startCommand(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code !== 0) {
      console.error(`[${label}] exited with code ${code}${signal ? ` (${signal})` : ""}`);
      shutdown(code || 1);
    }
  });

  children.push(child);
  return child;
}

function waitForFreshBuild(filePath, buildStartedAt, timeoutMs = 120000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs >= buildStartedAt) {
          resolve();
          return;
        }
      }

      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`Timed out waiting for file: ${filePath}`));
        return;
      }

      setTimeout(attempt, 1000);
    };

    attempt();
  });
}

function waitForHealth(url, timeoutMs = 30000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });

      req.on("error", retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`Backend did not become ready within ${timeoutMs / 1000}s`));
        return;
      }
      setTimeout(attempt, 1000);
    };

    attempt();
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill("SIGTERM");
      } catch (_) {}
    }
  }

  setTimeout(() => process.exit(exitCode), 200);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  const buildStartedAt = Date.now();

  if (fs.existsSync(publicDir)) {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }

  console.log("[local] starting frontend build watcher -> server/public ...");
  startCommand("client-build", "npm", ["run", "build:watch:public"], clientDir);

  await waitForFreshBuild(publicIndex, buildStartedAt);
  console.log(`[local] frontend ready at ${publicIndex}`);

  console.log("[local] starting backend with nodemon on http://localhost:3000 ...");
  startCommand("server", "npm", ["run", "dev"], serverDir);

  await waitForHealth("http://localhost:3000/api/health");
  console.log("[local] app ready on http://localhost:3000");
}

main().catch((error) => {
  console.error(`[local] startup failed: ${error.message}`);
  shutdown(1);
});
