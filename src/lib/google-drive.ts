const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now) {
    return cachedAccessToken.token;
  }

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN || "",
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) throw new Error(`Google token error: ${response.statusText}`);

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000 - 60000,
  };
  return data.access_token;
}

export async function listDriveItems(folderId: string | null = null) {
  const token = await getAccessToken();
  const query = folderId ? `'${folderId}' in parents` : "'root' in parents";

  const response = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(query + " and trashed=false")}&fields=files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,createdTime,size)&pageSize=100&orderBy=folder,name`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => response.statusText);
    throw new Error(`Drive API error: ${errBody}`);
  }
  const data = (await response.json()) as { files: any[] };
  return data.files || [];
}

export async function createFolder(folderName: string, parentId: string | null = null) {
  const token = await getAccessToken();

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?fields=id,name,mimeType`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : ["root"],
    }),
  });

  if (!response.ok) throw new Error("Failed to create folder");
  return response.json();
}

export async function deleteItem(itemId: string) {
  const token = await getAccessToken();

  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${itemId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Failed to delete item");
}

export async function renameItem(itemId: string, newName: string) {
  const token = await getAccessToken();

  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${itemId}?fields=id,name`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: newName }),
  });

  if (!response.ok) throw new Error("Failed to rename item");
  return response.json();
}

export async function moveItem(itemId: string, newParentId: string | null = null) {
  const token = await getAccessToken();

  const response = await fetch(`${GOOGLE_DRIVE_API}/files/${itemId}?fields=id,parents`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parents: newParentId ? [newParentId] : ["root"],
    }),
  });

  if (!response.ok) throw new Error("Failed to move item");
  return response.json();
}
