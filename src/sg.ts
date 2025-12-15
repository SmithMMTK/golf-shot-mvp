import type { Round, Shot } from "./types";
import { OTT_TABLE, APP_TABLE, ARG_TABLE, PUTT_TABLE } from "./sgTables";

type Cat = "OTT" | "APP" | "ARG" | "PUTT";

function isIgnored(s: Shot) {
  const b = s.lieBefore;
  const a = s.lieAfter;
  return b === "Layup" || a === "Layup" || b === "Penalty" || a === "Penalty";
}

// floor-match: เลือกแถวที่ key <= value และใกล้ที่สุด
function floorLookup<T extends { [k: string]: number }>(
  value: number,
  table: T[],
  key: keyof T,
  out: keyof T
) {
  let best: T | null = null;
  for (const row of table) {
    if (row[key] <= value) best = row;
    else break;
  }
  return best ? (best[out] as number) : (table[0][out] as number);
}

function catOfShot(par: number | undefined, shotNo: number, s: Shot): Cat | null {
  if (isIgnored(s)) return null;

  if (s.lieBefore === "Green") return "PUTT";
  if (shotNo === 1 && s.lieBefore === "Tee" && (par ?? 0) >= 4 && (s.distBefore ?? 0) >= 300)
    return "OTT";
  if ((s.distBefore ?? 0) <= 30) return "ARG";
  return "APP";
}

function expBefore(cat: Cat, distBefore: number): number {
  switch (cat) {
    case "OTT":
      return floorLookup(distBefore, OTT_TABLE, "par", "ev");   // distBefore = hole length
    case "APP":
      return floorLookup(distBefore, APP_TABLE, "dist", "ev");
    case "ARG":
      return floorLookup(distBefore, ARG_TABLE, "dist", "ev");
    case "PUTT":
      return floorLookup(distBefore, PUTT_TABLE, "dist", "ev");
  }
}

function expAfter(lieAfter: string, distAfter: number): number {
  if (lieAfter === "Holed") return 0;
  if (lieAfter === "Green") return floorLookup(distAfter, PUTT_TABLE, "dist", "ev");
  if (distAfter <= 30) return floorLookup(distAfter, ARG_TABLE, "dist", "ev");
  return floorLookup(distAfter, APP_TABLE, "dist", "ev");
}

export function computeSgTotals(round: Round) {
  let ott = 0, app = 0, arg = 0, putt = 0;

  for (const h of round.holes) {
    const par = h.par;

    for (const s of h.shots) {
      const cat = catOfShot(par, s.shot, s);
      if (!cat) continue;

      const before = expBefore(cat, s.distBefore ?? 0);
      const after = expAfter(s.lieAfter ?? "", s.distAfter ?? 0);

      const sg = before - after - 1;

      if (cat === "OTT") ott += sg;
      else if (cat === "APP") app += sg;
      else if (cat === "ARG") arg += sg;
      else putt += sg;
    }
  }

  const t2g = ott + app + arg;
  const total = t2g + putt;

  const r1 = (x: number) => Math.round(x * 100) / 100;

  return {
    ott: r1(ott),
    app: r1(app),
    arg: r1(arg),
    putt: r1(putt),
    t2g: r1(t2g),
    total: r1(total),
  };
}