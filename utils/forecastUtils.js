function groupForecastByDate(list = []) {
  const byDate = {};
  if (!Array.isArray(list)) return byDate;
  for (const item of list) {
    const dtTxt = item?.dt_txt;
    if (typeof dtTxt !== "string") continue;
    const [dateStr] = dtTxt.split(" ");
    if (!dateStr) continue;
    (byDate[dateStr] ||= []).push(item);
  }
  return byDate;
}

function summarizeDailyForecast(list = [], { days = 5 } = {}) {
  const byDate = groupForecastByDate(list);
  const dateKeys = Object.keys(byDate).sort();

  const out = [];
  for (const dateStr of dateKeys) {
    const entries = byDate[dateStr];
    if (!Array.isArray(entries) || entries.length === 0) continue;

    let min = Infinity;
    let max = -Infinity;
    for (const e of entries) {
      const tMin = e?.main?.temp_min;
      const tMax = e?.main?.temp_max;
      if (typeof tMin === "number" && Number.isFinite(tMin)) min = Math.min(min, tMin);
      if (typeof tMax === "number" && Number.isFinite(tMax)) max = Math.max(max, tMax);
    }

    const noon =
      entries.find((e) => typeof e?.dt_txt === "string" && e.dt_txt.includes("12:00:00")) ||
      entries[Math.floor(entries.length / 2)];
    const w = noon?.weather?.[0] || entries[0]?.weather?.[0] || {};

    out.push({
      dateStr,
      min: Number.isFinite(min) ? Math.round(min) : null,
      max: Number.isFinite(max) ? Math.round(max) : null,
      icon: w.icon || null,
      main: w.main || null,
      desc: w.description || null,
    });

    if (out.length >= days) break;
  }

  return out;
}

module.exports = { groupForecastByDate, summarizeDailyForecast };

