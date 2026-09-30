import type { Quote } from "@/domain/market/types";

/** Quote with Date → epoch ms, safe to pass to client components / JSON. */
export type QuoteDTO = Omit<Quote, "asOf"> & { asOf: number };

export function serializeQuote(q: Quote): QuoteDTO {
  return { ...q, asOf: q.asOf.getTime() };
}
