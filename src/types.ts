export type Shot = {
  shot: number;
  lieBefore: string;
  distBefore: number;
  lieAfter: string;
  distAfter: number;
};

export type Hole = {
  hole: number;
  par?: number;
  shots: Shot[];
};

export type Round = {
  date: string;
  course: string;
  roundId: string;
  holes: Hole[];
};