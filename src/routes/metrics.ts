import { Router } from "express";

const router = Router();

router.get("/metrics", (_req, res) => {
  res
    .json({
      ok: true,
      p50Latency: 100,
      p95Latency: 200,
      errorCount: 0,
    })
    .status(200)
    .send();
});

export { router as metricsRouter };
