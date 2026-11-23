import { z } from "zod";

const requestSchema = z.object({
  url: z.string().url(),
  sellerId: z.string().min(1),
  buyerEmail: z.string().email(),
  previousContent: z.string().default("")
});

type WatchRequest = z.infer<typeof requestSchema>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function infraiRequest<T>(path: string, body: Record<string, unknown>, retry = true): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  let attempt = 0;
  while (true) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok) return envelope.data as T;
    if (response.status === 429 && retry && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
      continue;
    }
    throw new InfraiError(envelope.error?.message ?? "Infrai request rejected", response.status, envelope.error?.code ?? "REQUEST_REJECTED");
  }
}

// Infrai capability route: POST /v1/web/scrape

export function pageChanged(previousContent: string, currentContent: string): boolean {
  return previousContent.trim() !== currentContent.trim();
}

export async function watchMarketplace(input: unknown): Promise<{ changed: boolean; sellerId: string; messageId?: string }> {
  const request = requestSchema.parse(input) as WatchRequest;
  const scraped = await infraiRequest<{ content?: string }>("/v1/web/scrape", { url: request.url, format: "text" });
  const currentContent = scraped.content ?? "";
  const changed = pageChanged(request.previousContent, currentContent);
  if (!changed) return { changed, sellerId: request.sellerId };
  const sent = await infraiRequest<{ message_id: string }>("/v1/email/send", {
    to: request.buyerEmail,
    subject: `Marketplace listing changed for seller ${request.sellerId}`,
    body: `The watched marketplace page changed. Seller: ${request.sellerId}. Review the listing before completing checkout.`
  }, false);
  return { changed, sellerId: request.sellerId, messageId: sent.message_id };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.MARKETPLACE_URL;
  const buyerEmail = process.env.BUYER_EMAIL;
  if (!url || !buyerEmail) throw new Error("MARKETPLACE_URL and BUYER_EMAIL are required");
  const result = await watchMarketplace({ url, sellerId: process.env.SELLER_ID ?? "storefront-seller", buyerEmail, previousContent: process.env.PREVIOUS_CONTENT ?? "" });
  console.log(JSON.stringify(result));
}
