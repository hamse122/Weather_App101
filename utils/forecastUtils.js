function groupForecastByDate(list = []) {
  const byDate = new Map();

  if (!Array.isArray(list)) return byDate;

  for (const item of list) {
    const dtTxt = item?.dt_txt;
    if (typeof dtTxt !== "string") continue;

    const dateStr = dtTxt.slice(0, 10); // YYYY-MM-DD

    if (!byDate.has(dateStr)) {
      byDate.set(dateStr, []);
    }

    byDate.get(dateStr).push(item);
  }

  return byDate;
}

function summarizeDailyForecast(
  list = [],
  {
    days = 5,
    includeAverage = true,
  } = {}
) {
  const byDate = groupForecastByDate(list);

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, days)
    .map(([dateStr, entries]) => {
      let minTemp = Infinity;
      let maxTemp = -Infinity;
      let tempSum = 0;
      let tempCount = 0;

      const weatherCounts = new Map();

      for (const entry of entries) {
        const main = entry?.main;

        if (Number.isFinite(main?.temp_min)) {
          minTemp = Math.min(minTemp, main.temp_min);
        }

        if (Number.isFinite(main?.temp_max)) {
          maxTemp = Math.max(maxTemp, main.temp_max);
        }

        if (Number.isFinite(main?.temp)) {
          tempSum += main.temp;
          tempCount++;
        }

        const weather = entry?.weather?.[0];
        if (weather?.main) {
          weatherCounts.set(
            weather.main,
            (weatherCounts.get(weather.main) || 0) + 1
          );
        }
      }

      const representative =
        entries.find(e => e?.dt_txt?.includes("12:00:00")) ??
        entries[Math.floor(entries.length / 2)] ??
        {};

      const weather = representative.weather?.[0] || {};

      const dominantWeather =
        [...weatherCounts.entries()]
          .sort((a, b) => b[1] - a[1])[0]?.[0] ?? weather.main ?? null;

      return {
        date: dateStr,
        min: Number.isFinite(minTemp) ? Math.round(minTemp) : null,
        max: Number.isFinite(maxTemp) ? Math.round(maxTemp) : null,
        avg:
          includeAverage && tempCount
            ? Math.round(tempSum / tempCount)
            : null,
        weather: dominantWeather,
        description: weather.description ?? null,
        icon: weather.icon ?? null,
        entries: entries.length,
      };
    });
}

module.exports = {
  groupForecastByDate,
  summarizeDailyForecast,
};
