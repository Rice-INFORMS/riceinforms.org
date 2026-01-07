// assets/js/events-admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// 1)Firebase config (Firebase Console → Project settings → Your apps)
const firebaseConfig = {
    apiKey: "AIzaSyCLKiW9wNrGLLARLJYT5QsQYkK8q8ALNYY",
    authDomain: "rice-informs.firebaseapp.com",
    projectId: "rice-informs",
    storageBucket: "rice-informs.firebasestorage.app",
    messagingSenderId: "470650869170",
    appId: "1:470650869170:web:ce806366f3d16e7c6980ab",
    measurementId: "G-N417193H28"
};

// 2) Dev allowlist (ONLY these accounts can add items)
const ADMIN_EMAILS = new Set([
  "bae5@rice.edu",
  "beckedwards314@gmail.com",
  "gbd2@rice.edu"
  // "other@gmail.com"
]);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


let IS_ADMIN = false;
let lastEventDocs = [];

const btnSignIn = document.getElementById("btnSignIn");
const btnSignOut = document.getElementById("btnSignOut");
const authStatus = document.getElementById("authStatus");


const adminForm = document.getElementById("adminFormEvents");
const tbody = document.getElementById("eventsTbody");

// Form fields
const fName = document.getElementById("fEventName");
const fWhen = document.getElementById("fEventWhen");
const fLoc  = document.getElementById("fEventLocation");
const fAbout= document.getElementById("fEventAbout");

// Collection name for events
const EVENTS_COL = "events";

// Query: sort upcoming soonest by default (low -> high time)
const q = query(collection(db, EVENTS_COL), orderBy("startAt", "asc"));

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function formatWhen(ts) {
  if (!ts) return "—";
  const dt = ts.toDate ? ts.toDate() : new Date(ts);
  // User timezone is America/Chicago; browser will handle local display
  return dt.toLocaleString([], {
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
      <td colspan="4">
        <span class="events-divider-label">${escapeHtml(label)}</span>
      </td>
    </tr>
  `;
}



function appendEventRow(d) {
  const e = d.data();
  const tr = document.createElement("tr");
  const aboutCell = `
    <td class="text-muted">
        <div class="d-flex align-items-start justify-content-between gap-2">
        <span class="event-about flex-grow-1">${escapeHtml(e.about)}</span>
        ${
            IS_ADMIN
            ? `<button class="btn btn-sm btn-outline-danger js-delete"
                        type="button"
                        data-id="${d.id}">
                Remove
                </button>`
            : ``
        }
        </div>
    </td>
    `;


  tr.innerHTML = `
    <td class="fw-semibold">${escapeHtml(e.name)}</td>
    <td class="text-muted">${escapeHtml(formatWhen(e.startAt))}</td>
    <td class="text-muted">${escapeHtml(e.location)}</td>
    ${aboutCell}
    `;


  tbody.appendChild(tr);
}



function renderRows(docs) {
  tbody.innerHTML = "";

  if (!docs.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted py-4">No events yet.</td></tr>`;
    return;
  }

  const now = Date.now();
  const isFuture = (d) => {
    const ts = d.data()?.startAt;
    return ts?.toDate ? ts.toDate().getTime() >= now : false;
  };

  const upcoming = docs.filter(isFuture);
  const passed = docs.filter((d) => !isFuture(d));

  // Upcoming section (only if there are upcoming events)
  if (upcoming.length) {
    tbody.insertAdjacentHTML("beforeend", sectionRow("Upcoming", "upcoming"));
    for (const d of upcoming) appendEventRow(d);
  }

  // Passed section (only if there are passed events)
  if (passed.length) {
    tbody.insertAdjacentHTML("beforeend", sectionRow("Passed", "passed"));
    for (const d of passed) appendEventRow(d);
  }

  // If you want: if no upcoming, still show "Passed" only; this already does that.
}


// Sign-in / out
btnSignIn?.addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("SIGN-IN ERROR:", e.code, e.message, e);
    alert(`Sign-in failed: ${e.code || e.message}`);
  }
});

btnSignOut?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("SIGN-OUT ERROR:", e.code, e.message, e);
    alert(`Sign-out failed: ${e.code || e.message}`);
  }
});


// Live updates
onSnapshot(q, (snap) => {
  lastEventDocs = snap.docs;
  setInterval(() => {
    if (lastEventDocs?.length) renderRows(sortEventDocs(lastEventDocs));
  }, 60_000); // re-sort every minute

  renderRows(sortEventDocs(lastEventDocs));
}, (err) => console.error("[events] snapshot error:", err));



// Delete handler (event delegation)
tbody.addEventListener("click", async (evt) => {
  const btn = evt.target.closest(".js-delete");
  if (!btn) return;
  if (!IS_ADMIN) return;

  const id = btn.getAttribute("data-id");
  if (!id) return;

  const ok = confirm("Remove this event? This cannot be undone.");
  if (!ok) return;

  await deleteDoc(doc(db, EVENTS_COL, id));
});

// Sort Events
function sortEventDocs(docs) {
  const now = Date.now();

  return [...docs].sort((a, b) => {
    const aData = a.data();
    const bData = b.data();

    const aMs = aData?.startAt?.toDate ? aData.startAt.toDate().getTime() : Number.NEGATIVE_INFINITY;
    const bMs = bData?.startAt?.toDate ? bData.startAt.toDate().getTime() : Number.NEGATIVE_INFINITY;

    const aIsFuture = aMs >= now;
    const bIsFuture = bMs >= now;

    // Future events first
    if (aIsFuture !== bIsFuture) return aIsFuture ? -1 : 1;

    // Both future: closest first (ascending)
    if (aIsFuture && bIsFuture) return aMs - bMs;

    // Both past: most recent first (descending)
    return bMs - aMs;
  });
}


// Admin form submit
adminForm.addEventListener("submit", async (evt) => {
  evt.preventDefault();
  if (!IS_ADMIN) return;

  const name = fName.value.trim();
  const whenStr = fWhen.value; // "YYYY-MM-DDTHH:MM"
  const location = fLoc.value.trim();
  const about = fAbout.value.trim();

  if (!name || !whenStr || !location || !about) return;

  // Convert datetime-local to Timestamp
  const whenDate = new Date(whenStr);
  const startAt = Timestamp.fromDate(whenDate);

  await addDoc(collection(db, EVENTS_COL), {
    name,
    startAt,
    location,
    about,
    createdAt: serverTimestamp(),
  });

  adminForm.reset();
});

function setAdminUI(user) {
  const signedIn = !!user;
  const isAdmin = signedIn && ADMIN_EMAILS.has(user.email);

  if (authStatus) {
    authStatus.textContent = signedIn
      ? `Dev mode: signed in as ${user.email}${isAdmin ? "" : " (no edit access)"}`
      : "Dev mode: signed out";
  }

  btnSignIn?.classList.toggle("d-none", signedIn);
  btnSignOut?.classList.toggle("d-none", !signedIn);
  adminForm?.classList.toggle("d-none", !isAdmin);
}

// Auth state -> toggle admin UI
onAuthStateChanged(auth, (user) => {
  IS_ADMIN = !!user && ADMIN_EMAILS.has(user.email);
  setAdminUI(user);
  renderRows(sortEventDocs(lastEventDocs));

  // Critical: refresh table so Remove buttons appear/disappear immediately
  renderRows(lastEventDocs);
});





// OPTIONAL: if you already have shared sign-in/out buttons in your footer,
// wire them up here the same way you did in decisionlab-admin.js.
// If you paste your existing footer controls, I will connect them exactly.
