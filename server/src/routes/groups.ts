import { Router } from "express";
import { Group, GroupCreateSchema } from "@stonx/shared";

const groups: Group[] = [
  {
    id: "mega-cap-tech",
    name: "MegaCap Tech",
    type: "manual",
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN"],
  },
  {
    id: "semis",
    name: "Semiconductors",
    type: "manual",
    symbols: ["NVDA", "AVGO", "AMD", "TSM"],
  },
  {
    id: "energy",
    name: "Energy",
    type: "manual",
    symbols: ["XOM", "CVX", "COP", "SLB"],
  },
];

export const groupsRouter = Router();

groupsRouter.get("/", (_req, res) => {
  res.json({ data: groups });
});

groupsRouter.get("/:id", (req, res) => {
  const found = groups.find((g) => g.id === req.params.id);
  if (!found) {
    return res.status(404).json({ error: "Group not found" });
  }
  res.json({ data: found });
});

groupsRouter.post("/", (req, res) => {
  const parsed = GroupCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      issues: parsed.error.flatten(),
    });
  }

  const { name, symbols } = parsed.data;
  const newGroup: Group = {
    id: slugify(name),
    name,
    type: "manual",
    symbols,
  };
  groups.push(newGroup);
  res.status(201).json({ data: newGroup });
});

groupsRouter.put("/:id/members", (req, res) => {
  const target = groups.find((g) => g.id === req.params.id);
  if (!target) {
    return res.status(404).json({ error: "Group not found" });
  }
  const parsed = GroupCreateSchema.pick({ symbols: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      issues: parsed.error.flatten(),
    });
  }
  target.symbols = parsed.data.symbols;
  res.json({ data: target });
});

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
