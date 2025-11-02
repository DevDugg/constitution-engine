import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ ok: true }).status(200).send();
});

export { router as healthRouter };
