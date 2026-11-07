/**
 * Pure aggregation: counter rows in, dashboard-ready stats out.
 *
 * Kept dependency-free and side-effect-free so it is easy to test and so the
 * storage layer can change without touching the response shape.
 */

const TOP_LIMIT = 20;

function sumMap(map, key, count) {
  map.set(key, (map.get(key) ?? 0) + count);
}

function parseAllowlist(value) {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {object} input
 * @param {Array<{app:string,day:string,event:string,dim1:string,dim2:string,count:number}>} input.rows
 * @param {Array<{app:string,name?:string}>} input.apps
 * @param {Array<{app:string,event:string,dim1_allow:string,dim2_allow:string}>} input.registry
 * @param {string[]} input.days - UTC day keys, oldest first, last is "today".
 * @returns dashboard payload
 */
export function buildStats({ rows, apps, registry, days }) {
  const dayIndex = new Map(days.map((day, index) => [day, index]));
  const today = days[days.length - 1];
  const order = new Map(apps.map((entry) => [entry.app, entry]));

  const registryByApp = new Map();
  for (const entry of registry) {
    const current = registryByApp.get(entry.app) ?? new Map();
    current.set(entry.event, {
      dim1: parseAllowlist(entry.dim1_allow),
      dim2: parseAllowlist(entry.dim2_allow),
    });
    registryByApp.set(entry.app, current);
  }

  const buckets = new Map();
  for (const entry of apps) {
    buckets.set(entry.app, {
      app: entry.app,
      name: entry.name || entry.app,
      total: 0,
      today: 0,
      series: days.map((day) => ({ day, count: 0 })),
      events: new Map(),
      dims: new Map(),
      buttons: new Map(),
      unregistered: new Map(),
    });
  }

  for (const row of rows ?? []) {
    const bucket = buckets.get(row.app);
    if (!bucket) continue; // rows for an app that no longer exists
    const count = Number(row.count) || 0;
    bucket.total += count;
    if (row.day === today) bucket.today += count;
    const index = dayIndex.get(row.day);
    if (index !== undefined) bucket.series[index].count += count;
    sumMap(bucket.events, row.event, count);

    if (row.dim1) sumMap(bucket.dims, `${row.event}\u0000${row.dim1}`, count);
    if (row.event === 'ui_click' && row.dim1) sumMap(bucket.buttons, row.dim1, count);

    // Flag traffic whose dim1 is not declared in the app registry, so typos and
    // forgotten buttons are visible in the dashboard.
    const declared = registryByApp.get(row.app)?.get(row.event);
    if (row.dim1 && declared && declared.dim1.length > 0 && !declared.dim1.includes(row.dim1)) {
      sumMap(bucket.unregistered, `${row.event}\u0000${row.dim1}`, count);
    }
  }

  const appList = [...buckets.values()]
    .sort((a, b) => (order.get(a.app)?.app ?? '').localeCompare(order.get(b.app)?.app ?? ''))
    .map((bucket) => {
      const events = [...bucket.events.entries()]
        .map(([event, count]) => ({ event, count }))
        .sort((a, b) => b.count - a.count);
      const top = [...bucket.dims.entries()]
        .map(([key, count]) => {
          const [event, dim1] = key.split('\u0000');
          return { event, dim1, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_LIMIT);
      const buttons = [...bucket.buttons.entries()]
        .map(([dim1, count]) => ({ dim1, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_LIMIT);
      const unregistered = [...bucket.unregistered.entries()]
        .map(([key, count]) => {
          const [event, dim1] = key.split('\u0000');
          return { event, dim1, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_LIMIT);
      return {
        app: bucket.app,
        name: bucket.name,
        total: bucket.total,
        today: bucket.today,
        series: bucket.series,
        events,
        buttons,
        top,
        unregistered,
      };
    });

  return {
    days,
    total: appList.reduce((sum, app) => sum + app.total, 0),
    apps: appList,
  };
}
