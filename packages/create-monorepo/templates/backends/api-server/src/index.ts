import cors from "cors";
import express, { type Response } from "express";
import type { ApiSuccess, HealthPayload } from "{{SCOPE_CONTRACTS}}";

const app = express();
const port = Number(process.env.PORT ?? 9999);

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req, res: Response<ApiSuccess<HealthPayload>>) => {
  res.status(200).json({
    status: "ok",
    data: { ok: true, service: "{{SCOPE_API}}" },
  });
});

app.listen(port, () => {
  console.log(`{{SCOPE_API}} listening on http://localhost:${port}`);
});
