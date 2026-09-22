function groupForecastByDate(
    list = [],
    {
        timezone = "UTC"
    } = {}
) {
    const grouped = new Map();

    if (!Array.isArray(list)) {
        return grouped;
    }

    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });

    for (const item of list) {
        if (!item) continue;

        let date = null;

        if (Number.isFinite(item.dt)) {
            date = new Date(item.dt * 1000);
        } else if (typeof item.dt_txt === "string") {
            const parsed = new Date(item.dt_txt);
            if (!Number.isNaN(parsed.getTime())) {
                date = parsed;
            }
        }

        if (!date || Number.isNaN(date.getTime())) {
            continue;
        }

        const key = formatter.format(date);

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
    if (!Number.isInteger(days) || days < 1) {
        throw new Error("days must be a positive integer");
    }

    const grouped = groupForecastByDate(list, { timezone });

    const dayFormatter = new Intl.DateTimeFormat(locale, {
        weekday: "long",
        timeZone: timezone
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

            let tempCount = 0;
            let humidityCount = 0;
            let windCount = 0;
            let popCount = 0;

            let rain = 0;
            let snow = 0;

            const weatherCount = new Map();

            let representative = null;
            let bestDistance = Infinity;

            for (const entry of entries) {
                const main = entry?.main ?? {};

                if (Number.isFinite(main.temp_min)) {
                    min = Math.min(min, main.temp_min);
                }

                if (Number.isFinite(main.temp_max)) {
                    max = Math.max(max, main.temp_max);
                }

                if (Number.isFinite(main.temp)) {
                    tempSum += main.temp;
                    tempCount++;
                }

                if (Number.isFinite(main.humidity)) {
                    humiditySum += main.humidity;
                    humidityCount++;
                }

                if (Number.isFinite(entry?.wind?.speed)) {
                    windSum += entry.wind.speed;
                    windCount++;
                }

                if (Number.isFinite(entry?.pop)) {
                    popSum += entry.pop;
                    popCount++;
                }

                if (Number.isFinite(entry?.rain?.["3h"])) {
                    rain += entry.rain["3h"];
                }

                if (Number.isFinite(entry?.snow?.["3h"])) {
                    snow += entry.snow["3h"];
                }

                const weather = entry?.weather?.[0];

                if (weather?.main) {
                    weatherCount.set(
                        weather.main,
                        (weatherCount.get(weather.main) || 0) + 1
                    );
                }

                // Find forecast closest to 12:00 local time
                if (Number.isFinite(entry?.dt)) {
                    const date = new Date(entry.dt * 1000);

                    const hour = Number(
                        new Intl.DateTimeFormat("en-US", {
                            hour: "numeric",
                            hourCycle: "h23",
                            timeZone: timezone
                        }).format(date)
                    );

                    const distance = Math.abs(hour - 12);

                    if (distance < bestDistance) {
                        bestDistance = distance;
                        representative = entry;
                    }
                }
            }

            representative ??=
                entries[Math.floor(entries.length / 2)] ?? null;

            const weather = representative?.weather?.[0] ?? {};

            const dominant =
                [...weatherCount.entries()]
                    .sort((a, b) => b[1] - a[1])[0]?.[0] ??
                weather.main ??
                null;

            // Use noon UTC to create a stable date object for weekday formatting.
            const date = new Date(`${dateStr}T12:00:00Z`);

            return {
                date: dateStr,

                dayName: dayFormatter.format(date),

                min: Number.isFinite(min)
                    ? Math.round(min)
                    : null,

                max: Number.isFinite(max)
                    ? Math.round(max)
                    : null,

                avg:
                    includeAverage && tempCount
                        ? Math.round(tempSum / tempCount)
                        : null,

                humidity: humidityCount
                    ? Math.round(humiditySum / humidityCount)
                    : null,

                wind: windCount
                    ? Number((windSum / windCount).toFixed(1))
                    : null,

                precipitationProbability: popCount
                    ? Math.round((popSum / popCount) * 100)
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
                    ? { hourly: [...entries] }
                    : {})
            };
        });
}

module.exports = {
    groupForecastByDate,
    summarizeDailyForecast
};
