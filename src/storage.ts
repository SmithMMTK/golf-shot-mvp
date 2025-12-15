import { get, set, del } from "idb-keyval";
import type { Round } from "./types";

const KEY = "draft-round";

export async function saveDraft(round: Round) {
  await set(KEY, round);
}

export async function loadDraft(): Promise<Round | null> {
  const data = await get<Round>(KEY);
  return data ?? null;
}

export async function clearDraft() {
  await del(KEY);
}