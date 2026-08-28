(function exposeBirdtripMigrationTiming(root) {
  "use strict";

  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Name-based family matching keeps the groups dependency-free; species that
  // match no group still count toward "All migrants".
  const GROUPS = Object.freeze([
    Object.freeze({
      key: "all",
      label: "All migrants",
      pattern: null,
      description: "Every species whose occurrence pattern here looks migratory."
    }),
    Object.freeze({
      key: "warblers",
      label: "Warblers",
      pattern: /\b(?:warbler|ovenbird|waterthrush|redstart|parula|yellowthroat|chat)\b/i,
      description: "Wood-warblers, including waterthrushes, Ovenbird, and Yellow-breasted Chat."
    }),
    Object.freeze({
      key: "waterfowl",
      label: "Waterfowl",
      pattern: /\b(?:duck|goose|swan|teal|wigeon|scaup|merganser|bufflehead|goldeneye|pintail|gadwall|shoveler|canvasback|redhead|scoter|eider|brant|mallard)\b/i,
      description: "Ducks, geese, and swans."
    }),
    Object.freeze({
      key: "shorebirds",
      label: "Shorebirds",
      pattern: /\b(?:sandpiper|plover|dowitcher|yellowlegs|godwit|curlew|whimbrel|turnstone|sanderling|dunlin|snipe|woodcock|phalarope|avocet|stilt|killdeer|willet|knot|oystercatcher|surfbird)\b/i,
      description: "Sandpipers, plovers, and their relatives."
    }),
    Object.freeze({
      key: "raptors",
      label: "Raptors",
      pattern: /\b(?:hawk|goshawk|eagle|falcon|kestrel|merlin|harrier|kite|osprey|vulture|caracara)\b/i,
      description: "Hawks, eagles, falcons, kites, and vultures."
    }),
    Object.freeze({
      key: "hummingbirds",
      label: "Hummingbirds",
      pattern: /\bhummingbird\b/i,
      description: "Hummingbirds."
    })
  ]);

  const STATUS_LABELS = Object.freeze({
    passage: "Passing through",
    summer: "Summer birds",
    winter: "Winter birds",
    irregular: "Irregular visitors",
    resident: "Year-round residents",
    scarce: "Too scarce to judge"
  });

  function isGroup(value) {
    return GROUPS.some((group) => group.key === value);
  }

  function groupByKey(key) {
    return GROUPS.find((group) => group.key === key) || GROUPS[0];
  }

  function classifyGroup(comName) {
    const name = String(comName || "");
    for (const group of GROUPS) {
      if (group.pattern && group.pattern.test(name)) return group.key;
    }
    return null;
  }

  function normalizedPresence(presence) {
    const max = Math.max(...presence, 0);
    if (max <= 0) return presence.map(() => 0);
    return presence.map((value) => value / max);
  }

  // Statuses are judged on the species' own peak (normalized presence), so a
  // sparse-but-regular migrant reads the same as an abundant one. Sampling is
  // only a few dates per month, so rates are coarse (multiples of 1/sampled);
  // when the caller knows how many sampled days the species was actually seen
  // (totalDays), scarcity is judged on that count instead of on a rate
  // threshold the sampling resolution could never produce.
  function classifyStatus(presence, seasons, totalDays) {
    const max = Math.max(...presence, 0);
    if (max <= 0) return "scarce";
    if (Number.isFinite(totalDays) ? totalDays < 3 : max < 0.2) return "scarce";
    const norm = normalizedPresence(presence);
    const means = {};
    for (const season of seasons) {
      means[season.key] = season.months.reduce((sum, month) => sum + norm[month], 0) / season.months.length;
    }
    const { winter, spring, summer, fall } = means;
    if (Math.min(winter, spring, summer, fall) >= 0.4) return "resident";
    // Passage needs actual spring or fall occurrence; a single peak month in
    // one of those seasons yields a mean of 1/3, so 0.3 keeps it in.
    if (summer <= 0.35 && winter <= 0.35 && Math.max(spring, fall) >= 0.3) return "passage";
    if (summer >= 0.5 && winter <= 0.3) return "summer";
    if (winter >= 0.5 && summer <= 0.3) return "winter";
    return "irregular";
  }

  // Per-month movement, 0..1 per species. Passage (and irregular) birds are
  // migrating whenever they are present; seasonal residents move only while
  // arriving or departing, which shows up as month-over-month change.
  function movementByMonth(norm, status) {
    if (status === "resident" || status === "scarce") return Array(12).fill(0);
    if (status === "passage" || status === "irregular") return norm.slice();
    return norm.map((value, month) => {
      const previous = norm[(month + 11) % 12];
      const next = norm[(month + 1) % 12];
      return Math.min(1, Math.max(0, value - previous) + Math.max(0, value - next));
    });
  }

  // Contiguous runs of months at >=50% of the species' peak. Scanning starts at
  // the weakest month so a season that wraps December-January stays one run.
  function presenceRuns(norm) {
    let start = 0;
    for (let month = 1; month < 12; month += 1) {
      if (norm[month] < norm[start]) start = month;
    }
    const runs = [];
    let current = null;
    for (let offset = 0; offset < 12; offset += 1) {
      const month = (start + offset) % 12;
      if (norm[month] >= 0.5) {
        if (current) current.push(month);
        else current = [month];
      } else if (current) {
        runs.push(current);
        current = null;
      }
    }
    if (current) runs.push(current);
    runs.sort((a, b) => b.length - a.length);
    return runs.slice(0, 2).sort((a, b) => a[0] - b[0]);
  }

  function runLabel(run) {
    if (!Array.isArray(run) || !run.length) return "";
    const first = MONTH_LABELS[run[0]];
    const last = MONTH_LABELS[run[run.length - 1]];
    return first === last ? first : `${first}–${last}`;
  }

  function runsLabel(runs) {
    return runs.map(runLabel).filter(Boolean).join(" and ");
  }

  // Spring/fall peak months of the combined movement index. Halves follow the
  // hemisphere so "spring" stays the northbound season south of the equator.
  function peakWindows(monthly, latitude) {
    const south = Number(latitude) < 0;
    const halves = south
      ? [{ key: "spring", months: [6, 7, 8, 9, 10, 11] }, { key: "fall", months: [0, 1, 2, 3, 4, 5] }]
      : [{ key: "spring", months: [0, 1, 2, 3, 4, 5] }, { key: "fall", months: [6, 7, 8, 9, 10, 11] }];
    const result = {};
    for (const half of halves) {
      let peak = null;
      for (const month of half.months) {
        if (monthly[month] > 0 && (peak === null || monthly[month] > monthly[peak])) peak = month;
      }
      if (peak === null) {
        result[half.key] = null;
        continue;
      }
      const index = half.months.indexOf(peak);
      const months = [peak];
      for (let i = index - 1; i >= 0 && monthly[half.months[i]] >= 0.6 * monthly[peak]; i -= 1) {
        months.unshift(half.months[i]);
      }
      for (let i = index + 1; i < half.months.length && monthly[half.months[i]] >= 0.6 * monthly[peak]; i += 1) {
        months.push(half.months[i]);
      }
      result[half.key] = { peak, months };
    }
    return result;
  }

  function buildMigrationTiming(speciesList, sampledDays, options = {}) {
    const seasonal = root.BirdtripSeasonal;
    const latitude = Number.isFinite(Number(options.latitude)) ? Number(options.latitude) : 40;
    const groupKey = isGroup(options.group) ? options.group : "all";
    const seasons = seasonal.seasonsForLatitude(latitude);
    const buckets = { passage: [], summer: [], winter: [], irregular: [] };
    const monthly = Array(12).fill(0);
    const movingCount = Array(12).fill(0);
    let residentCount = 0;
    let scarceCount = 0;
    let groupTotal = 0;

    for (const species of Array.isArray(speciesList) ? speciesList : []) {
      if (groupKey !== "all" && classifyGroup(species.comName) !== groupKey) continue;
      groupTotal += 1;
      const presence = seasonal.presenceRates(species.months, sampledDays);
      const totalDays = Array.isArray(species.months)
        ? species.months.reduce((sum, count) => sum + (Number(count) || 0), 0)
        : NaN;
      const status = classifyStatus(presence, seasons, totalDays);
      if (status === "resident") {
        residentCount += 1;
        continue;
      }
      if (status === "scarce") {
        scarceCount += 1;
        continue;
      }
      const norm = normalizedPresence(presence);
      const movement = movementByMonth(norm, status);
      movement.forEach((value, month) => {
        monthly[month] += value;
        if (value >= 0.25) movingCount[month] += 1;
      });
      buckets[status].push({
        speciesCode: species.speciesCode,
        comName: species.comName,
        sciName: species.sciName || "",
        presence,
        peakRate: Math.max(...presence, 0),
        status,
        movement,
        runs: presenceRuns(norm)
      });
    }

    for (const key of Object.keys(buckets)) {
      buckets[key].sort((a, b) => b.peakRate - a.peakRate || a.comName.localeCompare(b.comName));
    }

    return {
      groupKey,
      group: groupByKey(groupKey),
      seasons,
      buckets,
      monthly,
      movingCount,
      migrantCount: buckets.passage.length + buckets.summer.length + buckets.winter.length + buckets.irregular.length,
      residentCount,
      scarceCount,
      groupTotal,
      peaks: peakWindows(monthly, latitude)
    };
  }

  root.BirdtripMigrationTiming = Object.freeze({
    MONTH_LABELS,
    MONTH_NAMES,
    GROUPS,
    STATUS_LABELS,
    isGroup,
    groupByKey,
    classifyGroup,
    classifyStatus,
    normalizedPresence,
    movementByMonth,
    presenceRuns,
    runLabel,
    runsLabel,
    peakWindows,
    buildMigrationTiming
  });
}(globalThis));
