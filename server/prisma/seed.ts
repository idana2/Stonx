import { PrismaClient, GroupType } from "@prisma/client";

const prisma = new PrismaClient();

const tickerSymbols = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"];

type SeedGroup = {
  id: string;
  name: string;
  type: GroupType;
  symbols: string[];
};

const groups: SeedGroup[] = [
  {
    id: "mega-cap-tech",
    name: "MegaCap Tech",
    type: "manual",
    symbols: ["AAPL", "MSFT", "NVDA", "AMZN"],
  },
  {
    id: "my-watchlist",
    name: "My Watchlist",
    type: "manual",
    symbols: ["AAPL", "GOOGL"],
  },
];

async function main() {
  console.log("[seed] upserting tickers");
  for (const symbol of tickerSymbols) {
    await prisma.ticker.upsert({
      where: { symbol },
      update: {},
      create: { symbol },
    });
  }

  console.log("[seed] creating groups and members");
  for (const group of groups) {
    await prisma.group.upsert({
      where: { id: group.id },
      update: {
        name: group.name,
        type: group.type,
      },
      create: {
        id: group.id,
        name: group.name,
        type: group.type,
      },
    });

    const uniqueSymbols = Array.from(new Set(group.symbols));

    await prisma.groupMember.deleteMany({
      where: { groupId: group.id },
    });

    if (uniqueSymbols.length > 0) {
      await prisma.groupMember.createMany({
        data: uniqueSymbols.map((symbol) => ({
          groupId: group.id,
          symbol,
        })),
      });
    }
  }

  console.log("[seed] done");
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
