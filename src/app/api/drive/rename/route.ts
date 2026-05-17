import { renameItem } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { itemId, newName } = (await request.json()) as { itemId: string; newName: string };
    const result = await renameItem(itemId, newName);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
