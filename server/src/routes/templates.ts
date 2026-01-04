import { Router } from "express";
import { groupTemplates } from "../data/groupTemplates.js";

export const templatesRouter = Router();

templatesRouter.get("/", (_req, res) => {
  res.json({ data: groupTemplates });
});
