// Small helpers shared by the data modules.

export const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const div = (a, b) => (num(a) != null && num(b) ? a / b : null);

// `a` as a percentage of `b` (margins, shares of a total).
export const ratioPct = (a, b) => {
  const r = div(a, b);
  return r != null ? r * 100 : null;
};

// Percentage change from `b` to `a`.
export const changePct = (a, b) => {
  const r = div(a, b);
  return r != null ? (r - 1) * 100 : null;
};

export const isoDate = (d) => new Date(d).toISOString().slice(0, 10);
export const daysAgo = (n) => isoDate(Date.now() - n * 864e5);

export const httpError = (status, message) => Object.assign(new Error(message), { status });
