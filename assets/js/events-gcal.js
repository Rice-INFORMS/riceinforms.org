// assets/js/events-gcal.js

const API_KEY = "AIzaSyD3WCX77kuI7a5in8-8jKGOlSO80PKVBg0";
const CALENDAR_ID = "c_66007bef1693774364d56b50a73d09bad9d7bd9f90a3b71a872f0eb9ea691177@group.calendar.google.com"; // e.g. xxx@group.calendar.google.com
const tbody = document.getElementById("eventsTbody");

// Adjust how wide a window you want to show
const RANGE_PAST_DAYS = 365;
const RANGE_FUTURE_DAYS = 365;

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function formatWhen(date) {
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function sectionRow(label, section) {
  return `
    <tr class="events-divider" data-section="${section}">
      <td colspan="4"><span class="events-divider-label">${escapeHtml(label)}</span></td>
    </tr>
  `;
}

function sortEventsForDisplay(items) {
  const now = Date.now();

  const future = [];
  const past = [];

  for (const e of items) {
    if (!e.startAt) continue;
    (e.startAt.getTime() >= now ? future : past).push(e);
  }

  future.sort((a, b) => a.startAt - b.startAt); // soonest first
  past.sort((a, b) => b.startAt - a.startAt);   // most recent first

  return { future, past };
}

async function fetchCalendarEvents() {
  const now = new Date();

  const timeMin = new Date(now.getTime() - RANGE_PAST_DAYS * 864e5).toISOString();
  const timeMax = new Date(now.getTime() + RANGE_FUTURE_DAYS * 864e5).toISOString();

  // events.list supports singleEvents=true + orderBy=startTime. :contentReference[oaicite:5]{index=5}
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`);
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("maxResults", "2500");
  url.searchParams.set("timeZone", "America/Chicago");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar fetch failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const items = (data.items || [])
    .filter(ev => ev.status !== "cancelled")
    .map(ev => {
      const startStr = ev.start?.dateTime || ev.start?.date;
      const startAt = startStr ? new Date(startStr) : null;

      return {
        name: ev.summary || "Untitled event",
        location: ev.location || "—",
        about: (ev.description || "").trim() || "—",
        startAt
      };
    });

  return items;
}

function cleanGcalDescription(desc) {
  if (!desc) return "";

  let s = String(desc);

  // Normalize common HTML-ish formatting into plain text
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n\n");
  s = s.replace(/<li>/gi, "• ");
  s = s.replace(/<\/li>/gi, "\n");
  s = s.replace(/<\/ul>/gi, "\n");

  // Strip any remaining tags
  s = s.replace(/<[^>]*>/g, "");

  // Decode a few common HTML entities
  s = s.replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'");

  // Clean up whitespace
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// More parsing for pretty Gcal description 
function aboutToHtml(desc) {
  const text = cleanGcalDescription(desc);
  if (!text) return "—";

  const lines = text.split("\n");

  const blocks = [];
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      `<ul class="about-ul">` +
        listItems.map(li => `<li>${escapeHtml(li)}</li>`).join("") +
      `</ul>`
    );
    listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trim();

    // Blank line => paragraph break
    if (!line) {
      flushList();
      continue;
    }

    // Bullet line (supports •, -, *)
    const m = line.match(/^([•\-*])\s+(.*)$/);
    if (m) {
      listItems.push(m[2]);
      continue;
    }

    // Normal paragraph line
    flushList();
    blocks.push(`<p class="about-p">${escapeHtml(line)}</p>`);
  }

  flushList();
  return blocks.join("");
}


function renderTable(items) {
  tbody.innerHTML = "";

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted py-4">No events yet.</td></tr>`;
    return;
  }

  const { future, past } = sortEventsForDisplay(items);

  if (future.length) {
    tbody.insertAdjacentHTML("beforeend", sectionRow("Upcoming", "upcoming"));
    for (const e of future) {
      tbody.insertAdjacentHTML("beforeend", `
        <tr>
          <td class="fw-semibold">${escapeHtml(e.name)}</td>
          <td class="text-muted">${escapeHtml(formatWhen(e.startAt))}</td>
          <td class="text-muted">${escapeHtml(e.location)}</td>
          <td class="text-muted event-about-cell">${aboutToHtml(e.about)}</td>
        </tr>
      `);
    }
  }

  if (past.length) {
    tbody.insertAdjacentHTML("beforeend", sectionRow("Passed", "passed"));
    for (const e of past) {
      tbody.insertAdjacentHTML("beforeend", `
        <tr>
          <td class="fw-semibold">${escapeHtml(e.name)}</td>
          <td class="text-muted">${escapeHtml(formatWhen(e.startAt))}</td>
          <td class="text-muted">${escapeHtml(e.location)}</td>
          <td class="text-muted event-about-cell">${aboutToHtml(e.about)}</td>
        </tr>
      `);
    }
  }
}

(async function init() {
  try {
    const items = await fetchCalendarEvents();
    renderTable(items);

    // Keep ordering correct as time passes
    setInterval(() => renderTable(items), 60_000);
  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted py-4">Failed to load events.</td></tr>`;
  }
})();
