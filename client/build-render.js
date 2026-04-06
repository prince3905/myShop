const { spawnSync } = require("child_process");
const path = require("path");

const clientDir = __dirname;
const appDir = path.join(clientDir, "babaShop");
const outputPath = path.join("..", "..", "server", "public");

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

run("npm", ["install", "--include=dev"], appDir);
run("npm", ["run", "build:mobile", "--", `--output-path=${outputPath}`], appDir);
