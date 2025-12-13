import { Prisma, PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

const prisma = new PrismaClient();
export const groupsRouter = Router();

const groupCreateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["manual", "sector", "cluster"]).default("manual"),
});

const membersReplaceSchema = z.object({
  symbols: z.array(z.string().min(1)).default([]),
});

const formatGroup = (group: {
  id: string;
  name: string;
  type: string;
  members: { symbol: string }[];
}) => ({
  id: group.id,
  name: group.name,
  type: group.type,
  symbols: group.members.map((m) => m.symbol),
});

groupsRouter.get("/", async (_req, res) => {
  const groups = await prisma.group.findMany({
    include: { members: true },
    orderBy: { name: "asc" },
  });
  res.json({ data: groups.map(formatGroup) });
});

groupsRouter.get("/:id", async (req, res) => {
  const group = await prisma.group.findUnique({
    where: { id: req.params.id },
    include: { members: true },
  });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }
  res.json({ data: formatGroup(group) });
});

groupsRouter.post("/", async (req, res) => {
  const parsed = groupCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      issues: parsed.error.flatten(),
    });
  }

  const { name, type } = parsed.data;
  const id = slugify(name);

  try {
    const created = await prisma.group.create({
      data: { id, name, type },
      include: { members: true },
    });
    return res.status(201).json({ data: formatGroup(created) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(400).json({ error: "Group already exists with that name" });
    }
    throw error;
  }
});

groupsRouter.put("/:id/members", async (req, res) => {
  const parsed = membersReplaceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      issues: parsed.error.flatten(),
    });
  }

  const group = await prisma.group.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }

  const uniqueSymbols = Array.from(new Set(parsed.data.symbols));
  if (uniqueSymbols.length > 0) {
    const existingTickers = await prisma.ticker.findMany({
      where: { symbol: { in: uniqueSymbols } },
      select: { symbol: true },
    });
    const missing = uniqueSymbols.filter(
      (symbol) => !existingTickers.some((t) => t.symbol === symbol),
    );
    if (missing.length > 0) {
      return res
        .status(400)
        .json({ error: `Unknown ticker symbols: ${missing.join(", ")}` });
    }
  }

  const tx = [
    prisma.groupMember.deleteMany({ where: { groupId: group.id } }),
  ];

  if (uniqueSymbols.length > 0) {
    tx.push(
      prisma.groupMember.createMany({
        data: uniqueSymbols.map((symbol) => ({ groupId: group.id, symbol })),
      }),
    );
  }

  await prisma.$transaction(tx);

  const updated = await prisma.group.findUniqueOrThrow({
    where: { id: group.id },
    include: { members: true },
  });

  res.json({ data: formatGroup(updated) });
});

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
