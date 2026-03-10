## Q1. Run the app locally

**Question**  
How do I run the WeatherPro 2025 app on my computer?

**Body**  
I want simple step‑by‑step setup instructions with the correct Node version and environment variable.

**Answer**  
Use these steps:

1. Install **Node 20.9+**.  
2. In the project folder, run:  
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the project root with:  
   ```env
   OPENWEATHER_KEY=your_openweathermap_api_key_here
   ```
4. Start the dev server:  
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000` in your browser.

---

## Q2. “Missing OPENWEATHER_KEY” error

**Question**  
Why do I see the error “Missing OPENWEATHER_KEY in environment” when I search for a city?

**Body**  
I added an API key but the backend still says the `OPENWEATHER_KEY` environment variable is missing.

**Answer**  
The API route uses `process.env.OPENWEATHER_KEY`. To fix the error:

1. Make sure you have a `.env.local` file in the project root.  
2. Put this inside it (with your real key):  
   ```env
   OPENWEATHER_KEY=your_openweathermap_api_key_here
   ```
3. Stop and restart `npm run dev` so Next.js reloads the env vars.  

The README mentions `OPENWEATHER_API_KEY`, but for now the code expects `OPENWEATHER_KEY`.

---

## Q3. Weather card shows no data

**Question**  
Why does the main weather card stay empty even when `/api/weather` returns data?

**Body**  
The endpoint responds with JSON, but the UI sometimes doesn’t show temperature or city name.

**Answer**  
The API returns this structure:

```json
{
  "success": true,
  "city": "London",
  "current": { "...": "..." },
  "forecast": { "...": "..." }
}
```

But the UI expects fields at the top level like `weather.main` and `weather.name`. To fix it, either:

- Change the UI to use `weather.current` (and `weather.forecast`), or  
- Change the API to spread `current` onto the top level and keep `forecast` as a separate property.

---

## Q4. How the 5‑day forecast works

**Question**  
How is the 5‑day forecast under the main weather card calculated?

**Body**  
I want a simple explanation of how the app turns OpenWeather’s 3‑hour data into 5 daily forecast cards.

**Answer**  
When you search with `include=forecast`, the backend uses OpenWeather’s 5‑day / 3‑hour API. On the frontend, the `reduceToDaily` helper:

- Groups all 3‑hour entries by date,  
- Finds the **min** and **max** temperature for each day,  
- Chooses a representative entry (usually around midday) for the icon and description,  
- Returns up to **5 days** of data for the small forecast cards.

---

## Q5. How to contribute

**Question**  
How can I contribute improvements or bug fixes to this project?

**Body**  
I’d like a simple contribution workflow for forking, branching, and opening a pull request.

**Answer**  
Follow this flow:

1. **Fork** the repo on GitHub.  
2. Create a new branch:  
   ```bash
   git checkout -b my-feature-or-fix
   ```
3. Make your changes and test them locally.  
4. Commit and push the branch to your fork.  
5. Open a **Pull Request** explaining what you changed, why, and how you tested it.

---

## Q6. Deploying (e.g. to Vercel)

**Question**  
Can I deploy this app, and what do I need to configure?

**Body**  
I want a quick checklist to deploy WeatherPro 2025, for example on Vercel.

**Answer**  
Yes, this Next.js app can be deployed easily:

1. Connect your GitHub repo to Vercel.  
2. In Vercel project settings, add an environment variable:  
   - Key: `OPENWEATHER_KEY`  
   - Value: your real OpenWeather API key  
3. Deploy (Vercel usually builds automatically on push).  

Once deployed, your production app should work like `npm run dev` as long as `OPENWEATHER_KEY` is set correctly.

