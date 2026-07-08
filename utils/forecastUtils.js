function groupForecastByDate(
    list = [],
    {
        timezone = "UTC",
        locale = "en-US"
    } = {}
) {
    const grouped = new Map();

    if (!Array.isArray(list)) {
        return grouped;
    }

    for (const item of list) {

        if (!item) continue;

        let date;

        if (item.dt) {
            date = new Date(item.dt * 1000);
        } else if (item.dt_txt) {
            date = new Date(item.dt_txt);
        } else {
            continue;
        }

        const key = new Intl.DateTimeFormat("en-CA", {
            timeZone: timezone
        }).format(date);

        if (!grouped.has(key)) {
            grouped.set(key, []);
        }

        grouped.get(key).push(item);
    }

    return grouped;
}

function summarizeDailyForecast(
    list = [],
    {
        days = 5,
        timezone = "UTC",
        locale = "en-US",
        includeAverage = true,
        includeHourly = false
    } = {}
) {

    const grouped = groupForecastByDate(list, {
        timezone,
        locale
    });

    return [...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, days)
        .map(([dateStr, entries]) => {

            let min = Infinity;
            let max = -Infinity;

            let tempSum = 0;
            let humiditySum = 0;
            let windSum = 0;
            let popSum = 0;

            let rain = 0;
            let snow = 0;

            let count = 0;

            const weatherCount = new Map();

            let representative = null;
            let bestDistance = Infinity;

            for (const entry of entries) {

                const main = entry.main || {};

                if (Number.isFinite(main.temp_min))
                    min = Math.min(min, main.temp_min);

                if (Number.isFinite(main.temp_max))
                    max = Math.max(max, main.temp_max);

                if (Number.isFinite(main.temp)) {
                    tempSum += main.temp;
                    count++;
                }

                if (Number.isFinite(main.humidity))
                    humiditySum += main.humidity;

                if (Number.isFinite(entry.wind?.speed))
                    windSum += entry.wind.speed;

                if (Number.isFinite(entry.pop))
                    popSum += entry.pop;

                rain += entry.rain?.["3h"] || 0;
                snow += entry.snow?.["3h"] || 0;

                const weather = entry.weather?.[0];

                if (weather?.main) {
                    weatherCount.set(
                        weather.main,
                        (weatherCount.get(weather.main) || 0) + 1
                    );
                }

                // Closest forecast to 12:00
                if (entry.dt) {
                    const d = new Date(entry.dt * 1000);
                    const dist = Math.abs(d.getHours() - 12);

                    if (dist < bestDistance) {
                        bestDistance = dist;
                        representative = entry;
                    }
                }
            }

            representative ??= entries[Math.floor(entries.length / 2)];

            const weather = representative?.weather?.[0] || {};

            const dominant =
                [...weatherCount.entries()]
                    .sort((a, b) => b[1] - a[1])[0]?.[0] ??
                weather.main ??
                null;

            const date = new Date(dateStr);

            return {
                date: dateStr,

                dayName: new Intl.DateTimeFormat(locale, {
                    weekday: "long",
                    timeZone: timezone
                }).format(date),

                min: Number.isFinite(min)
                    ? Math.round(min)
                    : null,

                max: Number.isFinite(max)
                    ? Math.round(max)
                    : null,

                avg:
                    includeAverage && count
                        ? Math.round(tempSum / count)
                        : null,

                humidity:
                    count
                        ? Math.round(humiditySum / count)
                        : null,

                wind:
                    count
                        ? Number((windSum / count).toFixed(1))
                        : null,

                precipitationProbability:
                    count
                        ? Math.round((popSum / count) * 100)
                        : null,

                rain: Number(rain.toFixed(1)),
                snow: Number(snow.toFixed(1)),

                weather: dominant,
                description: weather.description ?? null,
                icon: weather.icon ?? null,

                sunrise: representative?.sys?.sunrise ?? null,
                sunset: representative?.sys?.sunset ?? null,

                entries: entries.length,

                ...(includeHourly
                    ? { hourly: entries }
                    : {})
            };
        });
}

module.exports = {
    groupForecastByDate,
    summarizeDailyForecast
};
