// Load test environment variables
require("dotenv").config({ path: ".env.test" });

const app = require("../app");
const { createTestClient } = require("./helpers/httpTestClient");

const request = createTestClient(app);

describe("Health Check", () => {
  test("GET /api/health should return 200 with ok status", async () => {
    const res = await request.get("/api/health");
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
  });
});

describe("Auth Routes", () => {
  test("POST /api/auth/login should return 400 without credentials", async () => {
    const res = await request.post("/api/auth/login", {});
    
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("success", false);
  });

  test("POST /api/auth/login should return 400 with invalid email", async () => {
    const res = await request.post("/api/auth/login", { email: "invalid", password: "123456" });
    
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("success", false);
  });
});

describe("Sales Routes", () => {
  test("GET /api/sales should return 401 without auth token", async () => {
    const res = await request.get("/api/sales");
    
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  test("POST /api/sales should return 401 without auth token", async () => {
    const res = await request.post("/api/sales", { customerName: "Test" });
    
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });
});

describe("Error Handler", () => {
  test("Non-existent route should return 404", async () => {
    const res = await request.get("/api/non-existent-route");
    
    expect(res.status).toBe(404);
  });
});

describe("Response Format", () => {
  test("Health endpoint should have consistent format", async () => {
    const res = await request.get("/api/health");
    
    expect(res.body).toHaveProperty("success");
    expect(typeof res.body.success).toBe("boolean");
  });
});
