import { moveItem } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { itemId, newParentId } = (await request.json()) as { itemId: string; newParentId?: string };
    const result = await moveItem(itemId, newParentId || null);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
