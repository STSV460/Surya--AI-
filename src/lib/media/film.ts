/**
 * Film orchestrator — generates per-shot videos via Wan 2.2.
 * Stitching is deferred to client (ffmpeg.wasm) for MVP — server returns shot URLs.
 */
import type { Storyboard } from "@/types/media";
import { generateVideoBlocking } from "./fal";

export interface FilmResult {
  shotUrls: string[];
}

export async function generateFilm(storyboard: Storyboard): Promise<FilmResult> {
  const shotUrls: string[] = [];
  for (const shot of storyboard.shots) {
    const url = await generateVideoBlocking({
      prompt: shot.prompt,
      durationSec: shot.durationSec,
      imageUrl: shot.imageUrl,
      mode: shot.imageUrl ? "i2v" : "t2v",
    });
    shotUrls.push(url);
  }
  return { shotUrls };
}
