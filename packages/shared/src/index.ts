import { z } from "zod";

export type GroupType = "manual" | "sector" | "cluster";

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  symbols: string[];
}

export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["manual", "sector", "cluster"]),
  symbols: z.array(z.string()),
});

export const PriceBarSchema = z.object({
  date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().optional(),
});

export type PriceBarDaily = z.infer<typeof PriceBarSchema>;

export const AnalysisRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
});

export type AnalysisRange = z.infer<typeof AnalysisRangeSchema>;

export const AnalysisRequestSchema = z
  .object({
    symbols: z.array(z.string()).nonempty().optional(),
    groupId: z.string().optional(),
    metrics: z.array(z.string()).optional(),
    range: AnalysisRangeSchema,
  })
  .refine((data) => data.symbols || data.groupId, {
    message: "Provide symbols or groupId",
    path: ["symbols"],
  });

export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

export interface MetricSnapshot {
  label: string;
  value: number | null;
  unit?: string;
  explanation?: string;
}

export type SignalSeverity = "info" | "warn" | "alert";

export interface SignalBadge {
  code: string;
  description: string;
  severity?: SignalSeverity;
}

export interface AnalysisResultRow {
  symbol: string;
  metrics: Record<string, MetricSnapshot>;
  signals: SignalBadge[];
}

export interface AnalysisResult {
  runId?: string;
  range: AnalysisRange;
  generatedAt: string;
  provider?: string;
  notes?: string[];
  rows: AnalysisResultRow[];
}

export const GroupCreateSchema = z.object({
  name: z.string().min(1),
  symbols: z.array(z.string()).default([]),
});

export type GroupCreate = z.infer<typeof GroupCreateSchema>;
