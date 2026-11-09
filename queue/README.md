# Daily scout batches

Each file here is one day's batch of songs for the Quick Weigh queue, written by the daily scout
(a scheduled Claude task). `npm run build` bundles the last 21 days of files into `src/queue-data.js`;
the site imports each batch once (tracked in the `settings` table as `scout:<batch>`) the next time
someone opens the review desk or the Quick Weigh queue. Every song lands as a **draft** marked as a
Claude starting draft: nothing goes live until a critic listens and publishes it.

File name: `YYYY-MM-DD.json`

```json
{
  "batch": "2026-11-10",
  "songs": [
    {
      "artist": "Artist Name",
      "title": "Song Title",
      "kind": "song",
      "genre": "hyperpop",
      "released": "Nov 2026",
      "verdict": "One sentence starting take (the critic rewrites it after listening).",
      "body": "Two short lines of context: who they are, what the song is going for.",
      "spotify_url": "https://open.spotify.com/track/...",
      "apple_url": "", "youtube_url": "", "soundcloud_url": "", "bandcamp_url": "",
      "tidal_url": "", "amazon_url": "", "deezer_url": "",
      "cover_url": "",
      "artist_ig": "handle",
      "artist_url": "",
      "scout_note": "Why it's here: where it's buzzing, numbers if known, which lane it fits."
    }
  ]
}
```

Rules for the scout: underground only (under ~100k monthly Spotify listeners, or no major-label deal),
released in the last ~60 days, at least one playable link (Spotify, YouTube, SoundCloud or Apple Music),
no song that's already on wackometer.com or in an earlier batch, and never full lyrics.
