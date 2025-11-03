import { Router } from "express";

const router = Router();

router.get("/health", (req, res) => {
  res
    .json({
      ok: true,
      correlationId: req.id,
    })
    .status(200)
    .send();
});

export { router as healthRouter };
