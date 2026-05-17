const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API = "https://api.spotify.com/v1";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getSpotifyToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.token;

  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Spotify token error: ${res.statusText}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in * 1000 - 60000 };
  return data.access_token;
}

export function extractSpotifyId(url: string, type: "album" | "artist"): string | null {
  const match = url.match(new RegExp(`spotify\\.com\\/${type}\\/([A-Za-z0-9]+)`));
  return match?.[1] ?? null;
}

export async function fetchSpotifyAlbum(albumId: string) {
  const token = await getSpotifyToken();
  const res = await fetch(`${SPOTIFY_API}/albums/${albumId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify album error: ${res.statusText}`);
  return res.json();
}

export async function fetchArtistAlbums(artistId: string) {
  const token = await getSpotifyToken();
  const res = await fetch(
    `${SPOTIFY_API}/artists/${artistId}/albums?include_groups=album,single&limit=50&market=IT`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Spotify artist albums error: ${res.statusText}`);
  return res.json();
}
