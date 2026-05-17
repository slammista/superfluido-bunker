import { createFolder } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { folderName, parentId } = (await request.json()) as { folderName: string; parentId?: string };
    const result = await createFolder(folderName, parentId || null);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
