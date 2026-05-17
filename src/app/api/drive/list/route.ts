import { listDriveItems } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { folderId } = (await request.json()) as { folderId?: string };
    const items = await listDriveItems(folderId || null);
    return Response.json({ items });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Drive list]", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
