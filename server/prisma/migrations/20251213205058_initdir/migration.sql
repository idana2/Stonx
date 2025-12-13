-- CreateTable
CREATE TABLE "Ticker" (
    "symbol" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "sector" TEXT,
    "industry" TEXT
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "groupId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,

    PRIMARY KEY ("groupId", "symbol"),
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Ticker" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceBarDaily" (
    "symbol" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL,

    PRIMARY KEY ("symbol", "date"),
    CONSTRAINT "PriceBarDaily_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Ticker" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" TEXT,
    "providerUsed" TEXT,
    "parametersJson" TEXT
);

-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "metricsJson" TEXT,
    "signalsJson" TEXT,
    CONSTRAINT "AnalysisResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AnalysisRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnalysisResult_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Ticker" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GroupMember_symbol_idx" ON "GroupMember"("symbol");

-- CreateIndex
CREATE INDEX "PriceBarDaily_date_idx" ON "PriceBarDaily"("date");

-- CreateIndex
CREATE INDEX "AnalysisResult_runId_idx" ON "AnalysisResult"("runId");

-- CreateIndex
CREATE INDEX "AnalysisResult_symbol_idx" ON "AnalysisResult"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisResult_runId_symbol_key" ON "AnalysisResult"("runId", "symbol");
