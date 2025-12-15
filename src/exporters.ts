import type { Round } from "./types";

export function exportCSV(round: Round) {
  const header = [
    "Date",
    "Course",
    "RoundId",
    "Hole",
    "Par",
    "Shot",
    "LieBefore",
    "DistBeforeYd",
    "LieAfter",
    "DistAfterYd",
    "ScrambleTry",   // J
    "ScrambleMade",  // K
  ];

  const rows: string[][] = [];

  for (const h of round.holes) {
    const par = h.par ?? null;

    const isHoled = h.shots.some((s) => s.lieAfter === "Holed");
    const totalStrokes = h.shots.length;

    // หา "ช็อตแรกที่ LieAfter = Green"
    const firstGreenIndex = h.shots.findIndex((s) => s.lieAfter === "Green"); // 0-based
    const firstGreenShotNo = firstGreenIndex >= 0 ? firstGreenIndex + 1 : null;

    // GIR แบบง่าย: เข้ากรีนภายใน (par-2) และไม่มี penalty ก่อนถึง green
    const isGIR =
      par && firstGreenShotNo !== null
        ? (function computeGIRSimple() {
            const target = Math.max(1, par - 2);
            let penaltyBeforeGreen = false;

            for (const s of h.shots) {
              if (s.lieAfter === "Penalty" || s.lieBefore === "Penalty") penaltyBeforeGreen = true;
              if (s.lieAfter === "Green") {
                return s.shot <= target && !penaltyBeforeGreen;
              }
            }
            return false;
          })()
        : false;

    // Scramble Try: ไม่ GIR และ "มีการเข้ากรีน" และมี par
    const scrambleTry =
      !!par && firstGreenShotNo !== null && !isGIR;

    // Scramble Made: Scramble Try + จบหลุม + ทำ Par
    const scrambleMade =
      scrambleTry && isHoled && par !== null && totalStrokes === par;

    for (const s of h.shots) {
      // ใส่ 1 เฉพาะ "บรรทัดที่เป็นช็อตแรกที่เข้ากรีน"
      const rowScrambleTry =
        scrambleTry && firstGreenShotNo === s.shot ? "1" : "";

      const rowScrambleMade =
        scrambleMade && firstGreenShotNo === s.shot ? "1" : "";

      rows.push([
        round.date,
        round.course,
        round.roundId,
        String(h.hole),
        String(h.par ?? ""),
        String(s.shot),
        s.lieBefore ?? "",
        String(s.distBefore ?? 0),
        s.lieAfter ?? "",
        String(s.distAfter ?? 0),
        rowScrambleTry,
        rowScrambleMade,
      ]);
    }
  }

  const csv =
    [header, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  download(blob, `shots_${round.roundId}.csv`);
}

function escapeCSV(v: string) {
  if (v == null) return "";
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}