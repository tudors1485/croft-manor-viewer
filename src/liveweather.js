// The real weather in Surrey today, where the manor stands (the same place the sun's path is
// worked out for, sky.js), from Open-Meteo: free, no key, no account, weather data under
// CC BY 4.0 (credited in the panel): the conditions now, and today's hour by hour (so the
// viewer can show today's real weather at noon, or at whatever hour the clock is set to). It is
// asked for when the viewer opens and every 15 minutes after, while the page is open. Nothing
// about the visitor is sent: only the place.

const FIELDS = 'weather_code,cloud_cover,precipitation,snow_depth,temperature_2m,wind_speed_10m,wind_gusts_10m,visibility';
const URL_NOW = `https://api.open-meteo.com/v1/forecast?latitude=51.3&longitude=-0.3&timezone=Europe%2FLondon&forecast_days=1&current=${FIELDS}&hourly=${FIELDS}`;
const EVERY = 15 * 60 * 1000;

export class LiveWeather {
  /** @param {(now: object|null) => void} onChange called with the current conditions, or null if they could not be had */
  constructor(onChange) {
    this.onChange = onChange;
    this.now = null; // Open-Meteo's `current` block
    this.failed = false;
    this._timer = 0;
  }

  start() {
    this.refresh();
    clearInterval(this._timer);
    this._timer = setInterval(() => document.visibilityState === 'visible' && this.refresh(), EVERY);
  }

  async refresh() {
    try {
      const res = await fetch(URL_NOW, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
      const body = await res.json();
      if (!body?.current || typeof body.current.weather_code !== 'number') throw new Error('no current weather');
      this.now = body.current;
      this.hourly = body.hourly ?? null;
      this.failed = false;
    } catch (err) {
      console.warn('live weather:', err.message);
      this.failed = !this.now;
    }
    this.onChange(this.now);
  }

  /**
   * The conditions at `hours` today (the nearest hour of today's forecast), or now when `hours`
   * is null; in the same shape as Open-Meteo's `current`.
   */
  at(hours = null) {
    if (hours == null || !this.hourly?.time?.length) return this.now;
    const i = Math.min(this.hourly.time.length - 1, Math.max(0, Math.round(hours)));
    const out = {};
    for (const k of FIELDS.split(',')) out[k] = this.hourly[k]?.[i];
    return typeof out.weather_code === 'number' ? out : this.now;
  }

  /** Snow lying, 0..1, from the snow depth (3 cm covers the ground). */
  snowLies(c) {
    const d = c?.snow_depth ?? 0;
    return Math.min(1, Math.max(0, d / 0.03));
  }

  /** Ponds freeze when it is below freezing for a while: 0 at 1 °C, frozen over at -3 °C. */
  ice(c) {
    const t = c?.temperature_2m;
    return t == null ? 0 : Math.min(1, Math.max(0, (1 - t) / 4));
  }

  temperature(c) {
    const t = c?.temperature_2m;
    return t == null ? '' : `${Math.round(t)}°C`;
  }
}
