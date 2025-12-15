import type { Round } from "./types";

export function exportJSON(round: Round) {
  const blob = new Blob([JSON.stringify(round, null, 2)], {
    type: "application/json",
  });
  download(blob, `round_${round.roundId}.json`);
}

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
  ];

  const rows: string[][] = [];

  round.holes.forEach((h) => {
    h.shots.forEach((s) => {
      rows.push([
        round.date,
        round.course,
        round.roundId,
        String(h.hole),
        String(h.par ?? ""),
        String(s.shot),
        s.lieBefore,
        String(s.distBefore),
        s.lieAfter,
        String(s.distAfter),
      ]);
    });
  });

  const csv =
    [header, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  download(blob, `shots_${round.roundId}.csv`);
}

function escapeCSV(v: string) {
  if (v == null) return "";
  if (v.includes(",") || v.includes('"')) {
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