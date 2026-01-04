-- CreateTable
CREATE TABLE "FundamentalQuarter" (
    "symbol" TEXT NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "fiscalYear" INTEGER,
    "fiscalQuarter" INTEGER,
    "currency" TEXT,
    "revenue" REAL,
    "grossProfit" REAL,
    "operatingIncome" REAL,
    "netIncome" REAL,
    "epsBasic" REAL,
    "epsDiluted" REAL,
    "totalAssets" REAL,
    "totalLiabilities" REAL,
    "cashAndEquivalents" REAL,
    "totalDebt" REAL,
    "sharesOutstanding" REAL,
    "epsTtm" REAL,
    "priceAsOf" DATETIME,
    "priceClose" REAL,
    "peTtm" REAL,
    "source" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("symbol", "periodEnd"),
    CONSTRAINT "FundamentalQuarter_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Ticker" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FundamentalSyncState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "status" TEXT,
    "lastRunAt" DATETIME,
    "lastError" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "FundamentalQuarter_periodEnd_idx" ON "FundamentalQuarter"("periodEnd");
