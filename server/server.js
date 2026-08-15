if (process.stdin && process.stdin.on) {
  process.stdin.on('error', () => {});
}

const mongoose = require('mongoose');
require("dotenv").config();
const app = require("./app");

const requiredEnvKeys = ["MONGO_URI", "PORT", "JWT_SECRET"];
const missingEnvKeys = requiredEnvKeys.filter((key) => !`${process.env[key] || ""}`.trim());

if (missingEnvKeys.length) {
  console.error(`Missing required environment variables: ${missingEnvKeys.join(", ")}`);
  console.error("Create server/.env from server/.env.example and fill in real values.");
  process.exit(1);
}

const port = Number(process.env.PORT);
const URL = `${process.env.MONGO_URI}`.trim();

mongoose
  .connect(URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('DB Connected successfully'))
  .catch((err) => console.error(err));

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});
