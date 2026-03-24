import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 9999);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "api-server",
    uptime: process.uptime(),
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Hello from @nb-hub/api-server!!",
  });
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});
