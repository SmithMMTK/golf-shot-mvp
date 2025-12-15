import { useEffect, useMemo, useState } from "react";
import type { Hole, Round, Shot } from "./types";
import { loadDraft, saveDraft } from "./storage";
import { exportCSV} from "./exporters";
import { computeStats } from "./stats";

const LIE_BEFORE = [
  "Tee",
  "Fairway",
  "Rough",
  "Fringe",
  "Green",
  "Bunker",
  "Layup",
  "Penalty",
] as const;

const LIE_AFTER = [
  "Fairway",
  "Rough",
  "Fringe",
  "Green",
  "Bunker",
  "Penalty",
  "Holed",
] as const;

function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function sanitizeCourseName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-ก-๙]/g, "");
}

function makeNewRound(course: string): Round {
  const today = new Date();
  const yyyy = today.getFullYear();
  const dddd = String(dayOfYear(today)).padStart(4, "0");
  const courseSafe = sanitizeCourseName(course || "MyCourse");
  const roundId = `${yyyy}${dddd}-${courseSafe}`;

  return {
    date: today.toISOString().slice(0, 10),
    course: courseSafe,
    roundId,
    holes: Array.from({ length: 18 }, (_, i) => ({
      hole: i + 1,
      shots: [],
    })),
  };
}

function clampInt(v: string, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

export default function App() {
  const [round, setRound] = useState<Round | null>(null);
  const [courseInput, setCourseInput] = useState("MyCourse");
  const [holeIndex, setHoleIndex] = useState(0);
  const [showHoles, setShowHoles] = useState(false);
  const [bootLoaded, setBootLoaded] = useState(false);
  const [view, setView] = useState<"hole" | "stats">("hole");

  // ✅ BOOT: load draft once
  useEffect(() => {
    loadDraft().then((d) => {
      if (d) {
        setRound(d);
        setHoleIndex(0);
      }
      setBootLoaded(true);
    });
  }, []);

  // ✅ Auto-save whenever round changes
  useEffect(() => {
    if (round) saveDraft(round);
  }, [round]);

  const hole: Hole | null = useMemo(() => {
    if (!round) return null;
    return round.holes[holeIndex] ?? null;
  }, [round, holeIndex]);

  function startRound() {
    const newRound = makeNewRound(courseInput);
    setRound(newRound);
    setHoleIndex(0);
  }

  function resumeRound() {
    loadDraft().then((d) => {
      if (d) {
        setRound(d);
        setHoleIndex(0);
      }
    });
  }



  function updateHole(nextHole: Hole) {
    if (!round) return;
    const holes = round.holes.slice();
    holes[holeIndex] = nextHole;
    setRound({ ...round, holes });
  }

  function setPar(par: number | undefined) {
    if (!hole) return;
    updateHole({ ...hole, par });
  }

  function addShot() {
    if (!hole) return;

    const shots = hole.shots.slice();
    const nextShotNo = shots.length + 1;

    let lieBefore = "";
    let distBefore = 0;

    const prev = shots[shots.length - 1];
    if (prev) {
      lieBefore = prev.lieAfter || "";
      distBefore = prev.distAfter ?? 0;
    }

    const newShot: Shot = {
      shot: nextShotNo,
      lieBefore,
      distBefore,
      lieAfter: "",
      distAfter: 0,
    };

    shots.push(newShot);
    updateHole({ ...hole, shots });
  }

  function updateShot(idx: number, patch: Partial<Shot>) {
    if (!hole) return;

    const shots = hole.shots.slice();
    const s = { ...shots[idx], ...patch };

    if (s.lieAfter === "Holed") {
      s.distAfter = 0;
    }

    shots[idx] = s;

    // Simple auto-fill next shot's before fields
    if (shots[idx + 1]) {
      shots[idx + 1] = {
        ...shots[idx + 1],
        lieBefore: s.lieAfter || shots[idx + 1].lieBefore,
        distBefore: s.distAfter ?? shots[idx + 1].distBefore,
      };
    }

    updateHole({ ...hole, shots });
  }

  function deleteLastShot() {
    if (!hole) return;
    if (hole.shots.length === 0) return;
    const shots = hole.shots.slice(0, -1);
    updateHole({ ...hole, shots });
  }

  function goPrevHole() {
    setHoleIndex((i) => Math.max(0, i - 1));
  }
  function goNextHole() {
    setHoleIndex((i) => Math.min(17, i + 1));
  }

  // Prevent flashing before boot loaded
  if (!bootLoaded) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui" }}>
        Loading…
      </div>
    );
  }

  // HOME
  if (!round) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui", color: "#111", maxWidth: 720 }}>
        <h1>Golf Shot MVP</h1>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Course name</label>
          <input
            value={courseInput}
            onChange={(e) => setCourseInput(e.target.value)}
            style={{ fontSize: 18, padding: 10, width: "100%" }}
          />
        </div>

        <button
          onClick={startRound}
          style={{ marginTop: 12, fontSize: 18, padding: "10px 14px" }}
        >
          Start Round
        </button>

        <button
          onClick={resumeRound}
          style={{ marginTop: 10, fontSize: 16, padding: "10px 14px" }}
        >
          Resume Round
        </button>
      </div>
    );
  }

  if (!hole) return null;

  if (view === "stats") {
  const s = computeStats(round);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", color: "#111", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={() => setView("hole")} style={{ padding: "8px 10px" }}>← Back</button>
        <div style={{ fontSize: 22, fontWeight: 700, flex: 1 }}>Statistics</div>
      </div>

      <div style={{ marginBottom: 12, color: "#555" }}>
        Round: <b>{round.roundId}</b>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card title="Holes started" value={`${s.holesStarted}/${s.holesTotal}`} />
        <Card title="Holes finished" value={`${s.holesFinished}/${s.holesTotal}`} />

        <Card title="Total shots" value={`${s.totalShots}`} />
        {/* <Card title="Avg shots (finished holes)" value={`${s.avgShotsPerFinishedHole}`} /> */}

        <Card title="FW hit %" value={`${s.fwHitPct}%`} sub={`${s.fwHits}/${s.fwOpportunities} (par 4/5 only)`} />
        <Card title="GIR %" value={`${s.girPct}%`} sub={`${s.girHits}/${s.girOpportunities} (simple)`} />
        <Card
          title="Scramble %"
          value={`${s.scramblePct}%`}
          sub={`${s.scrambleHits}/${s.scrambleOpp} (No GIR → Par)`}
        />
        <Card title="Putts" value={`${s.putts}`} />

        <Card title="Penalties" value={`${s.penalties}`} />
       {/* <Card title="Layups" value={`${s.layups}`} /> */}
        <Card
          title="Driving (Avg yd)"
          value={`${s.drivingAvg}`}
          sub={`${s.drivingCount} tee shots (par 4/5)`}
        />
        <Card title="Driving (Max yd)" value={`${s.drivingMax}`} />
      
      <SgCard title="SG Total" value={s.sg.total} />
      <SgCard title="T2G" value={s.sg.t2g} />
      <SgCard title="OTT" value={s.sg.ott} />
      <SgCard title="APP" value={s.sg.app} />
      <SgCard title="ARG" value={s.sg.arg} />
      <SgCard title="Putt" value={s.sg.putt} />

      
        
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>LieAfter breakdown</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(s.lieAfterCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", border: "1px solid #eee", borderRadius: 10, padding: "8px 10px" }}>
                <div>{k}</div>
                <div style={{ fontWeight: 700 }}>{v}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function SgCard(props: { title: string; value: number }) {
  const good = props.value >= 0;

  const border = good ? "1px solid #b7e4c7" : "1px solid #f5c2c7";
  const bg = good ? "#ecfdf3" : "#fff1f2";
  const color = good ? "#166534" : "#b91c1c";

  const v = Math.round(props.value * 100) / 100;
  const text = (v >= 0 ? "+" : "") + v.toFixed(2);

  return (
    <div style={{ border, background: bg, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, color: "#555" }}>{props.title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color }}>{text}</div>
    </div>
  );
}

// helper card component (วางไว้ท้ายไฟล์ App.tsx ก็ได้)
function Card(props: { title: string; value: string; sub?: string }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12, color: "#555" }}>{props.title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{props.value}</div>
      {props.sub && <div style={{ marginTop: 4, fontSize: 12, color: "#666" }}>{props.sub}</div>}
    </div>
  );
}

  const isHoled = hole.shots.some((s) => s.lieAfter === "Holed");

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", color: "#111", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={goPrevHole} style={{ padding: "8px 10px" }}>←</button>

        <button
          onClick={() => setRound(null)}   // ✅ กลับหน้า Home (draft ยังอยู่ เพราะ auto-save)
          style={{ padding: "8px 10px" }}
        >
        <button
          onClick={() => exportCSV(round)}
          style={{ padding: "8px 10px" }}
        >
          Export CSV
        </button>


        
          Home
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            Hole {hole.hole}
          </div>
          <div style={{ marginTop: 4 }}>
            Par:&nbsp;
            <select
              value={hole.par ?? ""}
              onChange={(e) => setPar(e.target.value ? Number(e.target.value) : undefined)}
              style={{ fontSize: 16, padding: 6 }}
            >
              <option value="">—</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
            <span style={{ marginLeft: 10, color: "#555" }}>(yd)</span>
          </div>
        </div>

        <button onClick={() => setShowHoles(true)} style={{ padding: "8px 10px" }}>Holes ▦</button>
        <button
          onClick={() => setView(view === "hole" ? "stats" : "hole")}
          style={{ padding: "8px 10px" }}
        >
          {view === "hole" ? "Stats" : "Back"}
        </button>



        <button onClick={goNextHole} style={{ padding: "8px 10px" }}>→</button>
      </div>

      {/* Round info + clear */}
      <div style={{ marginBottom: 12, color: "#555" }}>
        Round: <b>{round.roundId}</b>
      </div>

      {/* Shots */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {hole.shots.map((s, idx) => (
          <div key={s.shot} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Shot {s.shot}</div>
              {idx === hole.shots.length - 1 && (
                <button onClick={deleteLastShot} style={{ padding: "6px 10px" }}>
                  🗑 Delete last
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: "#555" }}>Lie Before</div>
                <select
                  value={s.lieBefore}
                  onChange={(e) => updateShot(idx, { lieBefore: e.target.value })}
                  style={{ width: "100%", fontSize: 16, padding: 8 }}
                >
                  <option value="">—</option>
                  {LIE_BEFORE.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#555" }}>Dist Before (yd)</div>
                <input
                  inputMode="numeric"
                  value={String(s.distBefore ?? 0)}
                  onChange={(e) => updateShot(idx, { distBefore: clampInt(e.target.value, 0) })}
                  style={{ width: "100%", fontSize: 16, padding: 8 }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#555" }}>Lie After</div>
                <select
                  value={s.lieAfter}
                  onChange={(e) => updateShot(idx, { lieAfter: e.target.value })}
                  style={{ width: "100%", fontSize: 16, padding: 8 }}
                >
                  <option value="">—</option>
                  {LIE_AFTER.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#555" }}>Dist After (yd)</div>
                <input
                  inputMode="numeric"
                  value={String(s.distAfter ?? 0)}
                  onChange={(e) => updateShot(idx, { distAfter: clampInt(e.target.value, 0) })}
                  style={{ width: "100%", fontSize: 16, padding: 8 }}
                  disabled={s.lieAfter === "Holed"}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add shot */}
      <button
        onClick={addShot}
        disabled={isHoled}
        style={{
          marginTop: 12,
          width: "100%",
          fontSize: 18,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid #ddd",
          background: isHoled ? "#f3f3f3" : "white",
        }}
      >
        + Add Shot

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>

        </div>

      </button>

      {/* Holes modal */}
      {showHoles && (
        <div
          onClick={() => setShowHoles(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              width: "100%",
              maxWidth: 720,
              borderRadius: 16,
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Select Hole</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
              {round.holes.map((h, i) => {
                const hasShots = h.shots.length > 0;
                const finished = h.shots.some((s) => s.lieAfter === "Holed");
                const parMissing = !h.par;

                const label = finished ? "✓" : hasShots ? "●" : "";
                const parLabel = parMissing ? "P?" : "";

                return (
                  <button
                    key={h.hole}
                    onClick={() => {
                      setHoleIndex(i);
                      setShowHoles(false);
                    }}
                    style={{
                      padding: "10px 0",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      background: i === holeIndex ? "#f3f3f3" : "white",
                      fontWeight: 700,
                    }}
                  >
                    {h.hole}
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginTop: 4 }}>
                      {label} {parLabel}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowHoles(false)}
              style={{ marginTop: 10, width: "100%", padding: "10px 12px", borderRadius: 12 }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}