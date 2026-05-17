import { listDriveItems } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { folderId } = (await request.json()) as { folderId?: string };
    const items = await listDriveItems(folderId || null);
    return Response.json({ items });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
