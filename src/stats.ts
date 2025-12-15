import type { Round } from "./types";

export type Stats = {
  holesTotal: number;
  holesStarted: number;
  holesFinished: number;

  totalShots: number;
  //avgShotsPerFinishedHole: number;

  penalties: number;
  layups: number;

  fwOpportunities: number;
  fwHits: number;
  fwHitPct: number; // 0-100

  girOpportunities: number;
  girHits: number;
  girPct: number; // 0-100

  lieAfterCounts: Record<string, number>;

  putts: number;

  scrambleOpp: number;   // โอกาส scramble (ไม่ GIR แต่จบหลุม)
  scrambleHits: number; // scramble สำเร็จ
  scramblePct: number;  // %

  drivingCount: number;
  drivingAvg: number;
  drivingMax: number;

};

function pct(hit: number, opp: number) {
  return opp === 0 ? 0 : Math.round((hit / opp) * 100);
}

// GIR แบบง่าย (และปลอดภัย): นับถ้า "ไปถึง Green" ภายใน (par-2) ช็อต
// และ "ไม่มี Penalty" ก่อนถึง Green
function computeGIRSimple(par: number, shots: { shot: number; lieAfter: string; lieBefore: string }[]) {
  const targetStroke = Math.max(1, par - 2);

  let penaltyBeforeGreen = false;
  for (const s of shots) {
    if (s.lieAfter === "Penalty" || s.lieBefore === "Penalty") penaltyBeforeGreen = true;
    if (s.lieAfter === "Green") {
      return s.shot <= targetStroke && !penaltyBeforeGreen;
    }
  }
  return false;
}

export function computeStats(round: Round): Stats {
  const holesTotal = round.holes.length;

  let holesStarted = 0;
  let holesFinished = 0;

  let totalShots = 0;
  let penalties = 0;
  let layups = 0;

  let fwOpportunities = 0;
  let fwHits = 0;

  let girOpportunities = 0;
  let girHits = 0;

  let putts = 0;
  let scrambleOpp = 0;
  let scrambleHits = 0;

  let drivingCount = 0;
  let drivingSum = 0;
  let drivingMax = 0;

  const lieAfterCounts: Record<string, number> = {};

  for (const h of round.holes) {
    if (h.shots.length > 0) holesStarted++;

    const finished = h.shots.some((s) => s.lieAfter === "Holed");
    if (finished) holesFinished++;

    totalShots += h.shots.length;

    for (const s of h.shots) {
      if (s.lieBefore === "Green") putts++;
      if (s.lieAfter) lieAfterCounts[s.lieAfter] = (lieAfterCounts[s.lieAfter] ?? 0) + 1;

      if (s.lieAfter === "Penalty" || s.lieBefore === "Penalty") penalties++;
      if (s.lieBefore === "Layup") layups++;
    }

    // FW hit: เฉพาะหลุม par 4/5 ที่มี par แล้ว และมี shot 1
    if ((h.par === 4 || h.par === 5) && h.shots.length >= 1) {
      fwOpportunities++;
      const s1 = h.shots[0];
      if (s1.lieAfter === "Fairway") fwHits++;
    }

    // GIR: เฉพาะหลุมที่มี par แล้ว
    if (h.par === 3 || h.par === 4 || h.par === 5) {
      girOpportunities++;
      if (computeGIRSimple(h.par, h.shots)) girHits++;
    }

    // --- Scramble ---
    // นับเฉพาะหลุมที่มี par และจบหลุม
    if (h.par && h.shots.some((s) => s.lieAfter === "Holed")) {
    const isGIR = computeGIRSimple(h.par, h.shots);

    if (!isGIR) {
        scrambleOpp++;

        const totalStrokes = h.shots.length;
        if (totalStrokes === h.par) {
        scrambleHits++;
        }
    }
    }
    
    // Driving distance (par 4/5 tee shot only): DistBefore - DistAfter
    if ((h.par === 4 || h.par === 5) && h.shots.length >= 1) {
    const s1 = h.shots[0];
    if (s1.lieBefore === "Tee") {
        const before = Number(s1.distBefore ?? 0);
        const after = Number(s1.distAfter ?? 0);
        const drive = before - after;

        if (Number.isFinite(drive) && drive > 0) {
        drivingCount++;
        drivingSum += drive;
        if (drive > drivingMax) drivingMax = drive;
        }
    }
    }

  }

  //const avgShotsPerFinishedHole =
  //  holesFinished === 0 ? 0 : Math.round((totalShots / holesFinished) * 10) / 10;

  return {
    holesTotal,
    holesStarted,
    holesFinished,
    totalShots,
    putts,
    //avgShotsPerFinishedHole,
    penalties,
    layups,
    fwOpportunities,
    fwHits,
    fwHitPct: pct(fwHits, fwOpportunities),
    girOpportunities,
    girHits,
    girPct: pct(girHits, girOpportunities),
    lieAfterCounts,
    scrambleOpp,
    scrambleHits,
    scramblePct: scrambleOpp === 0 ? 0 : Math.round((scrambleHits / scrambleOpp) * 100),
    drivingCount,
    drivingAvg: drivingCount === 0 ? 0 : Math.round((drivingSum / drivingCount) * 10) / 10,
    drivingMax,
  };
}