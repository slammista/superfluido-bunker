import { fetchSpotifyAlbum, fetchArtistAlbums, extractSpotifyId } from "@/lib/spotify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action: string; url?: string; artistId?: string };
    const { action, url, artistId } = body;

    if (action === "album") {
      if (!url) return Response.json({ error: "URL mancante" }, { status: 400 });
      const id = extractSpotifyId(url, "album");
      if (!id) return Response.json({ error: "URL album Spotify non valido" }, { status: 400 });
      const data = await fetchSpotifyAlbum(id);
      return Response.json({
        album: {
          spotify_album_id: data.id as string,
          nome_album: data.name as string,
          release_date: (data.release_date as string) ?? null,
          spotify_cover_url: (data.images as Array<{ url: string }>)?.[0]?.url ?? null,
          link_spotify: (data.external_urls as { spotify?: string })?.spotify ?? null,
        },
      });
    }

    if (action === "artist_albums") {
      if (!artistId) return Response.json({ error: "artistId mancante" }, { status: 400 });
      const data = await fetchArtistAlbums(artistId);
      const items = ((data.items ?? []) as Array<Record<string, unknown>>).map((a) => ({
        spotify_id: a.id as string,
        nome_album: a.name as string,
        release_date: (a.release_date as string) ?? null,
        cover_url: ((a.images as Array<{ url: string }>)?.[0]?.url) ?? null,
        link_spotify: ((a.external_urls as Record<string, string>)?.spotify) ?? null,
        artist_name: ((a.artists as Array<{ name: string }>)?.[0]?.name) ?? "",
      }));
      return Response.json({ items });
    }

    return Response.json({ error: "Azione non riconosciuta" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Errore";
    console.error("[Spotify]", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
