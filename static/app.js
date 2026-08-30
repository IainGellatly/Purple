const surveyConfig = [
  {
    id: 1,
    question: "What are your favorite festival attractions?",
    max: 3,
    options: [
      {id:1, label:"Artisan Booth Shopping"},
      {id:2, label:"Craft Demonstrations"},
      {id:3, label:"Food Trucks"},
      {id:4, label:"Food Booths"},
      {id:5, label:"Specialty Beverages"},
      {id:6, label:"Musical Entertainment"},
      {id:7, label:"Other (add comment below)"}
    ]
  },
  {
    id: 2,
    question: "What would you like to see more of?",
    max: 3,
    options: [
      {id:1, label:"Artisan Booth Shopping"},
      {id:2, label:"Craft Demonstrations"},
      {id:3, label:"Food Trucks"},
      {id:4, label:"Food Booths"},
      {id:5, label:"Specialty Beverages"},
      {id:6, label:"Musical Entertainment"},
      {id:7, label:"Other (add comment below)"}
    ]
  },
  {
    id: 3,
    question: "How long are you staying today?",
    max: 1,
    options: [
      {id:1, label:"1-2 Hours"},
      {id:2, label:"3-4 Hours"},
      {id:3, label:"5-6 Hours"},
      {id:4, label:"All Day"}
    ]
  }
];

let surveyAnswers = {};
let surveyComment = "";

const VAPID_PUBLIC_KEY = "BPAr2_PD2PGYvI0EsANa5gCXJ6z_hupiV6Bjdt7jxMaL_0D_QFdF-PbP3wDDNBM8PNzvbWRQegM9WH0yOyDVJ00";

function initializeInstallUI() {

  const btn =
    document.getElementById('installButton');

  const installUI =
    document.getElementById('installContainer');

  if (btn) {
    btn.addEventListener('click', installApp);
  }

  if (installUI) {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;

    installUI.style.display =
      standalone ? 'none' : 'block';
  }
}

// --------- PLATFORM DETECTION ----------
const isApple = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

// --------- FACEBOOK BROWSER DETECTION ----------
const ua = navigator.userAgent;

const isFacebookBrowser =
    ua.includes("FB")
    || ua.includes("FBAN")
    || ua.includes("FBAV")
    || ua.includes("FB_IAB");

function showFacebookBrowserMessage() {

    if (!isFacebookBrowser)
        return;

    const overlay = document.createElement("div");
    overlay.className = "vote-modal";

    overlay.innerHTML = `

        <div class="vote-modal-content">

            <div class="vote-modal-header">
                Open in External Browser
            </div>

            <div style="
                text-align:left;
                padding:10px;
                font-size:18px;
                line-height:1.5;
            ">

                Facebook's built-in browser prevents
                App installation.

                <br><br>

                Tap the corner menu (⋮ or ⋯)<br>
                Select "Open in external browser"</b>

                <br><br>

                for the best Purple App experience.

            </div>

            <button onclick="closeFacebookBrowserMessage()">
                Continue
            </button>

        </div>
    `;

    document.body.appendChild(overlay);
}

function closeFacebookBrowserMessage(){

    const modal =
        document.querySelector(".vote-modal");

    if (modal)
        modal.remove();
}

// ---------- INSTALL APP ----------

let deferredInstallPrompt = null;

let todayRefreshTimer = null;
let savedScrollY = 0;
let gpsWatchId = null;

// ============================================================
// TEMPORARY GPS TEST MODE
// Set TEST_GPS_ENABLED to false before production.
// ============================================================

const TEST_GPS_ENABLED = false;

//const TEST_GPS_LAT = 43.042016;    //parking location
//const TEST_GPS_LON = -77.252877;

const TEST_GPS_LAT = 43.040637;    //near house location
const TEST_GPS_LON = -77.257733;

const TEST_GPS_ACCURACY_FEET = 20;

// Parking spot GPS quality control.
// The spot will not be saved until GPS reports an accuracy
// of 50 feet or better.  It will wait up to 20 seconds.
const PARKING_ACCURACY_THRESHOLD_FEET = 50;
const PARKING_GPS_TIMEOUT_MS = 20000;


let subscriptionId = 0;
let pushAuthorized = false;
let alertSet = new Set();

let deviceId = localStorage.getItem("device_id");

if (!deviceId){
  deviceId = crypto.randomUUID();
  localStorage.setItem("device_id", deviceId);
}

function ordinal(n){
  if (n % 100 >= 11 && n % 100 <= 13) return n + "th";

  switch (n % 10){
    case 1: return n + "st";
    case 2: return n + "nd";
    case 3: return n + "rd";
    default: return n + "th";
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function openVotePicker(category){

  const data = voteData[category];

  const overlay = document.createElement("div");
  overlay.className = "vote-modal";

  overlay.innerHTML = `
    <div class="vote-modal-content">

      <div class="vote-modal-header">
        Select ${category.charAt(0).toUpperCase() + category.slice(1)}
      </div>

      <input
        type="text"
        placeholder="Search..."
        oninput="filterVoteList(this.value)"
        class="vote-search"
      >

      <div id="vote-list">
        ${data.map(x => `
          <div class="vote-item ${voteSelection[category] === x.vendor_id ? 'selected' : ''}"
               onclick="selectVoteModal('${category}', ${x.vendor_id}, this)">
            ${x.vendor_name}
          </div>
        `).join('')}
      </div>

      <button onclick="closeVoteModal()">Close</button>

    </div>
  `;

  document.body.appendChild(overlay);
}

function closeVoteModal(){
  const modal = document.querySelector(".vote-modal");
  if (modal) modal.remove();
}

function selectVoteModal(category, id, el){

  voteSelection[category] = id;

  document.querySelectorAll(".vote-item")
    .forEach(x => x.classList.remove("selected"));

  el.classList.add("selected");

  setTimeout(() => {
    closeVoteModal();
    loadVotePage(); // refresh cards
  }, 150);
}

function filterVoteList(text){

  text = text.toLowerCase();

  document.querySelectorAll(".vote-item").forEach(el => {
    const match = el.innerText.toLowerCase().includes(text);
    el.style.display = match ? "block" : "none";
  });
}

function showInstallInstructions(){

  // prevent duplicates
  if (document.getElementById('iosInstallOverlay')){
    return;
  }

  const overlay = document.createElement('div');

  overlay.id = 'iosInstallOverlay';

  overlay.innerHTML = `

    <div class="ios-install-sheet">

      <div class="ios-install-title">
        Install the Purple App
      </div>

      <div class="ios-install-step">
        1. Tap ⋯ and "Share".<br><br>
        2. Scroll down and tap "Add to Home Screen" <br><br>
        (Dont see it? Scroll to bottom, tap "Edit Actions", then "Add to Home Screen")<br><br>
        3. Tap "Add" in top corner
      </div>

      <div class="ios-install-step">
        Open the app using the Purple icon.
      </div>

      <button
        class="ios-install-close"
        onclick="closeInstallInstructions()"
      >
        Close
      </button>

    </div>
  `;

  document.body.appendChild(overlay);
}

function closeInstallInstructions(){

  const overlay =
    document.getElementById('iosInstallOverlay');

  if (overlay){
    overlay.remove();
  }
}

// ---------------- SERVICE WORKER ----------------
if ('serviceWorker' in navigator) {

    navigator.serviceWorker.register('/sw.js')
        .then(registration => {

            // Check for a new service worker immediately
            registration.update();

            // Check again every minute
            setInterval(() => {
                registration.update();
            }, 60000);

        })
        .catch(err => {
            console.warn(
                "Service worker registration failed:",
                err
            );
        });
}

document.addEventListener("visibilitychange", () => {

    if (
        document.visibilityState === "visible" &&
        navigator.serviceWorker
    ) {
        navigator.serviceWorker.ready.then(registration => {
            registration.update();
        });
    }

});

if ('serviceWorker' in navigator) {

    navigator.serviceWorker.addEventListener('controllerchange', () => {

        // Prevent reload loop
        if (window.__swReloaded) {
            return;
        }

        window.__swReloaded = true;

        console.log("New service worker activated. Reloading...");

        console.warn("**** PAGE RELOAD FROM controller change ****");
        window.location.reload();

    });

}

// ---------------- INSTALL PROMPT ----------------

// Android / Chrome
window.addEventListener('beforeinstallprompt', (e) => {

  e.preventDefault();

  deferredInstallPrompt = e;

  if (!isStandalone){

    const installUI =
      document.getElementById('installContainer');

    if (installUI){
      installUI.style.display = 'block';
    }
  }
});

// ---------------- HELPERS ----------------
function scrollToContent(){

  const el = document.getElementById('content');

  if (!el) return;

  const y =
    el.getBoundingClientRect().top +
    window.pageYOffset -
    12;   // adjust

  window.scrollTo({
    top: y,
    behavior: 'smooth'
  });
}

function goHome(){

  // keep smooth scroll exactly as-is
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 🔥 clear AFTER scroll completes (timed)
  setTimeout(() => {

    // stop any running timers (like Today page)
    if (todayRefreshTimer){
      clearInterval(todayRefreshTimer);
      todayRefreshTimer = null;
    }

    const content = document.getElementById("content");
    if (content){
      content.innerHTML = '';
    }

  }, 600); // small delay so scroll happens first
}

// ---------------- IOS DOWN-SWIPE HOME ----------------

let homeSwipeStartY = 0;

document.addEventListener('touchstart', (e) => {

  if (e.touches.length !== 1) {
    return;
  }

  homeSwipeStartY = e.touches[0].clientY;

}, { passive: true });


document.addEventListener('touchend', (e) => {

  if (!homeSwipeStartY) {
    return;
  }

  const endY = e.changedTouches[0].clientY;
  const deltaY = endY - homeSwipeStartY;

  homeSwipeStartY = 0;

  // Only react to a substantial downward swipe
  if (deltaY < 80) {
    return;
  }

  // Only when already at the top
  if (window.scrollY > 5) {
    return;
  }

  goHome();

}, { passive: true });

function renderLine(val){
  if (!val || val === 'null') return '';
  return `<div class="ui-card-body">${val}</div>`;
}

// ---------------- MORE ROW TOGGLE ----------------
function toggleMoreRow(){

  const items = document.querySelectorAll(".more-row");
  const isVisible = items[0].style.display === "block";

  items.forEach(el => {
    el.style.display = isVisible ? "none" : "block";
  });

  if (!isVisible && items.length > 0){
    items[0].scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}

function toggleVoteSection(id){

  const all = document.querySelectorAll('.vote-list');

  all.forEach(el => {
    if (el.id === 'vote-' + id){
      el.classList.toggle('active');
    } else {
      el.classList.remove('active');
    }
  });

  // optional: scroll opened section into view
  const el = document.getElementById('vote-' + id);
  if (el && el.classList.contains('active')){
    el.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

function formatDate(value) {

    if (!value)
        return "Never";

    return new Date(value)
        .toLocaleString();

}

async function loadDiagnostics() {

    const info =
        await CacheManager.getDiagnostics();

    let version = "Unknown";

    if (
        navigator.serviceWorker &&
        navigator.serviceWorker.controller
    ) {

        version = await new Promise(resolve => {

            const sw =
                navigator.serviceWorker.controller;

            function handler(event) {

                if (
                    event.data &&
                    event.data.type === "APP_VERSION"
                ) {

                    navigator.serviceWorker.removeEventListener(
                        "message",
                        handler
                    );

                    resolve(event.data.version);

                }

            }

            navigator.serviceWorker.addEventListener(
                "message",
                handler
            );

            sw.postMessage(
                "GET_APP_VERSION"
            );

        });

    }

    document.getElementById(
        "appDiagnostics"
    ).innerHTML =

        "<b>App Version:</b> " +
        version +

        "<br><b>Installed:</b> " +
        formatDate(
            info.installTime
        ) +

        "<br><b>Last Check:</b> " +
        formatDate(
            info.lastResourceCheck
        ) +

        "<br><b>Last Sync:</b> " +
        formatDate(
            info.lastSuccessfulSync
        );

}

// ---------------- EXPLORE ---------------------

let exploreVendors = [];
let exploreBooths = [];
let exploreCategories = [];
let exploreZones = [];

async function loadExplore() {

    await window.cacheReady;

    console.log("loadExplore()");

    const content = document.getElementById("content");

    /*
     * Load Explore data from the existing Purple IndexedDB
     * resource cache.
     */
    const vendorRecord =
        await CacheManager.getResource("vendors");

    const boothRecord =
        await CacheManager.getResource("booths");

    const categoryRecord =
        await CacheManager.getResource("categories");

    const zoneRecord =
        await CacheManager.getResource("zones");

    exploreVendors = vendorRecord?.data || [];
    exploreBooths = boothRecord?.data || [];
    exploreCategories = categoryRecord?.data || [];
    exploreZones = zoneRecord?.data || [];


    try {

        const html = `

            <div class="explore-page">

            <div class="ticket-header">
                <img
                    class="ticket-header-bg"
                    src="/static/icons/ticket_fill_pplf.png"
                    alt="ticket">
                <div class="ticket-header-content">
                    <div class="ticket-header-logo">
                        <img src="/static/icons/van.webp" alt="van">
                    </div>
                    <div class="ticket-header-text">
                        <div class="ticket-header-title">
                            Artists & Crafters
                        </div>
                        <div class="ticket-header-subtitle">
                            Type, tap or talk to explore!
                        </div>
                    </div>
                    <div class="ticket-header-date">
                        9/19-20, 2026
                    </div>
                </div>
            </div>

            <!-- Explore search -->

            <div class="search-row">

                <button
                    id="voice-button"
                    class="voice-button"
                    type="button"
                    aria-label="Talk to search">
                    🎤
                </button>

                <div class="search-controls">

                    <input
                        id="virtual-input"
                        type="text"
                        readonly
                        placeholder="Enter names, products, interests..."
                        class="search-input">

                    <button
                        id="browse-button"
                        class="browse-button"
                        type="button">

                        <span>Browse Artists</span>
                        <span class="browse-arrow">▼</span>

                    </button>

                </div>

            </div>


            <!-- Browse popup -->

            <div
                id="browse-overlay"
                class="browse-overlay">

                <div
                    id="browse-popup"
                    class="browse-popup"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="browse-title">

                    <div
                        id="browse-title"
                        class="browse-title">
                        Browse Vendors
                    </div>

                    <div
                        id="browse-category-list"
                        class="browse-category-list">
                    </div>

                    <button
                        id="browse-cancel"
                        class="browse-cancel"
                        type="button">
                        Cancel
                    </button>

                </div>

            </div>


            <!-- Vendor detail popup -->

            <div
                id="vendor-detail-overlay"
                class="vendor-detail-overlay">

                <div
                    id="vendor-detail-popup"
                    class="vendor-detail-popup"
                    role="dialog"
                    aria-modal="true">

                    <button
                        id="vendor-detail-close"
                        class="vendor-detail-close"
                        type="button"
                        aria-label="Close">
                        ×
                    </button>

                    <div
                        id="vendor-detail-content"
                        class="vendor-detail-content">
                    </div>

                </div>

            </div>


            <!-- Search / My Vendors -->

            <div class="tabbed-list-container">

                <div class="tab-headers">

                    <button
                        id="search-tab"
                        class="tab-button active-tab"
                        type="button">
                        Search (0)
                    </button>

                    <button
                        id="favorites-tab"
                        class="tab-button inactive-tab"
                        type="button">
                        My Favorites (0)
                    </button>

                </div>

                <div class="scroll-list">
                </div>

            </div>


            <!-- Map -->

            <button
                id="explore-map-button"
                class="map-button"
                type="button">

                Map My Favorites

            </button>


            <!-- Explore keyboard -->

            <div
                id="kb-container"
                class="keyboard-container">

                <div
                    id="keyboard-stack-target"
                    class="keyboard-stack">
                </div>

            </div>

        `;

        await CacheManager.renderHtml(content, html);
        await initializeExplore();
        scrollToContent();

    } catch (err) {

        console.error("Explore failed to load:", err);

        content.innerHTML =
            `<div class="card">
                Updating info. Drag down to refresh.
            </div>`;
    }
}

// ============================================================
// PARKING SPOT
// ============================================================

const PARKING_SPOT_KEY = "parking_spot";

async function getParkingSpot() {

    return await CacheManager.getMetadata(
        PARKING_SPOT_KEY
    );

}
function getCurrentPosition() {

    if (TEST_GPS_ENABLED){

        return Promise.resolve({

            coords: {

                latitude:
                    TEST_GPS_LAT,

                longitude:
                    TEST_GPS_LON,

                accuracy:
                    TEST_GPS_ACCURACY_FEET /
                    3.28084

            }

        });

    }


    return new Promise((resolve, reject) => {

        if (!("geolocation" in navigator)) {

            reject(
                new Error("Geolocation is not available.")
            );

            return;
        }

        navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 15000
            }
        );

    });

}


function getAccurateParkingPosition() {

    if (TEST_GPS_ENABLED){
        return Promise.resolve({
            coords: {
                latitude: TEST_GPS_LAT,
                longitude: TEST_GPS_LON,
                accuracy:
                    TEST_GPS_ACCURACY_FEET / 3.28084
            }
        });
    }

    return new Promise((resolve, reject) => {

        if (!("geolocation" in navigator)) {
            reject(
                new Error("Geolocation is not available.")
            );
            return;
        }

        let watchId = null;
        let timeoutId = null;
        let bestAccuracyFeet = Infinity;

        const cleanup = () => {
            if (watchId !== null){
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }

            if (timeoutId !== null){
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };

        const finish = (callback, value) => {
            cleanup();
            callback(value);
        };

        watchId = navigator.geolocation.watchPosition(
            (position) => {

                const accuracyMeters =
                    position.coords.accuracy || Infinity;

                const accuracyFeet =
                    accuracyMeters * 3.28084;

                bestAccuracyFeet =
                    Math.min(
                        bestAccuracyFeet,
                        accuracyFeet
                    );

                const button =
                    document.getElementById(
                        "parking-mark-button"
                    );

                const status =
                    document.getElementById(
                        "parking-status"
                    );

                if (status){
                    status.textContent =
                        `GPS accuracy: ±${Math.round(accuracyFeet)} feet`;
                }

                if (
                    button &&
                    accuracyFeet <=
                        PARKING_ACCURACY_THRESHOLD_FEET
                ){
                    button.textContent =
                        "Location Found!";
                }

                if (
                    accuracyFeet <=
                    PARKING_ACCURACY_THRESHOLD_FEET
                ){
                    finish(resolve, position);
                }

            },
            (error) => {
                finish(reject, error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
            }
        );

        timeoutId = setTimeout(() => {

            const error = new Error(
                "GPS accuracy did not improve enough."
            );

            error.code = 3;
            error.bestAccuracyFeet =
                Number.isFinite(bestAccuracyFeet)
                    ? Math.round(bestAccuracyFeet)
                    : null;

            finish(reject, error);

        }, PARKING_GPS_TIMEOUT_MS);

    });
}


async function markParkingSpot() {

    const button =
        document.getElementById(
            "parking-mark-button"
        );

    const status =
        document.getElementById(
            "parking-status"
        );

    if (button) {
        button.disabled = true;
        button.classList.add("gps-locating");
        button.textContent = "Finding Your Location...";
    }

    if (status){
        status.textContent =
            "Waiting for a more accurate GPS location...";
    }

    try {

        const position =
            await getAccurateParkingPosition();

        const latitude =
            position.coords.latitude;

        const longitude =
            position.coords.longitude;

        const accuracyMeters =
            position.coords.accuracy || 0;

        const accuracyFeet =
            Math.round(
                accuracyMeters * 3.28084
            );

        const existingSpot =
            await getParkingSpot();

        let message;

        if (existingSpot) {

            message =
                `Replace your saved parking spot with your current location? ` +
                `GPS accuracy is approx ±${accuracyFeet} feet.`;

        } else {

            message =
                `Save this as your parking spot? ` +
                `GPS accuracy is approx ±${accuracyFeet} feet.`;

        }

        if (!confirm(message)) {
            return;
        }

        await CacheManager.setMetadata(

            PARKING_SPOT_KEY,

            {
                latitude: latitude,
                longitude: longitude,
                accuracyFeet: accuracyFeet,
                savedAt: Date.now()
            }

        );

        if (button) {

            button.textContent =
                "Parking Spot Saved!";

        }

        if (status) {

            status.textContent =
                "Your car is saved on the festival map.";

        }

        setTimeout(() => {

            if (button) {
                button.textContent =
                    "Update My Spot";
            }

        }, 1800);

    } catch (err) {

        console.error(
            "Unable to save parking spot:",
            err
        );

        if (err.code === 1) {

            alert(
                "Location access was not allowed.\\n\\n" +
                "Please allow location access for the Purple App " +
                "and try again."
            );

        } else if (err.code === 2) {

            alert(
                "Your location could not be determined.\\n\\n" +
                "Please try again in a moment."
            );

        } else if (err.code === 3) {

            const best =
                Number.isFinite(err.bestAccuracyFeet)
                    ? `\\n\\nBest accuracy reached was approximately ±${err.bestAccuracyFeet} feet.`
                    : "";

            alert(
                "We could not get a sufficiently accurate GPS location.\\n\\n" +
                `Please try again. The location needs to be within ±${PARKING_ACCURACY_THRESHOLD_FEET} feet.` +
                best
            );

        } else {

            alert(
                "Unable to determine your location.\\n\\n" +
                "Please try again."
            );

        }

    } finally {

        if (button) {

            button.disabled = false;
            button.classList.remove("gps-locating");

            if (
                button.textContent ===
                "Finding Your Location..." ||
                button.textContent ===
                "Location Found!"
            ) {
                button.textContent =
                    "Mark My Parking Spot";
            }

        }

        if (
            status &&
            !await getParkingSpot()
        ){
            status.textContent = "";
        }

    }

}

function parkingDistanceMeters(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLon =
        (lon2 - lon1) *
        Math.PI / 180;


    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(
            lat1 * Math.PI / 180
        ) *

        Math.cos(
            lat2 * Math.PI / 180
        ) *

        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return R * c;

}


function formatParkingDistance(
    meters
) {

    const feet =
        meters * 3.28084;


    if (feet < 528) {

        return {
            text:
                `${Math.max(10, Math.round(feet / 10) * 10)} feet`,
            miles:
                feet / 5280
        };

    }


    const miles =
        feet / 5280;


    return {
        text:
            `${miles.toFixed(1)} miles`,
        miles:
            miles
    };

}


function parkingWalkingMinutes(
    miles
) {

    if (miles < 0.01) {
        return 0;
    }


    // 1.8 mph average walking speed
    return Math.max(
        1,
        Math.round(
            (miles / 1.8) * 60
        )
    );

}


async function showParkingDistance(
    map,
    parkingMarker,
    parkingSpot
) {

    try {

        const position =
            await getCurrentPosition();


        const currentLat =
            position.coords.latitude;

        const currentLon =
            position.coords.longitude;


        const meters =
            parkingDistanceMeters(

                currentLat,
                currentLon,

                Number(parkingSpot.latitude),
                Number(parkingSpot.longitude)

            );


        const distance =
            formatParkingDistance(
                meters
            );


        const minutes =
            parkingWalkingMinutes(
                distance.miles
            );


        let html;


        if (minutes === 0) {

            html = `
                <div class="parking-popup">
                    <div class="parking-popup-title">
                        🚗 Your Car
                    </div>

                    <div class="parking-popup-distance">
                        You're here!
                    </div>
                </div>
            `;

        } else {

            html = `
                <div class="parking-popup">
                    <div class="parking-popup-title">
                        🚗 Your Car
                    </div>

                    <div class="parking-popup-distance">
                        ${distance.text} away
                    </div>

                    <div class="parking-popup-time">
                        About ${minutes} min walk
                    </div>
                </div>
            `;

        }


        parkingMarker
            .bindPopup(
                html,
                {
                    maxWidth: 220
                }
            )
            .openPopup();


    } catch (err) {

        console.error(
            "Unable to update parking distance:",
            err
        );


        alert(
            "We could not determine your current location.\n\n" +
            "Please try again."
        );

    }

}


async function addParkingMarkerToMap(
    map
) {

    const parkingSpot =
        await getParkingSpot();


    if (
        !parkingSpot ||
        !Number.isFinite(
            Number(parkingSpot.latitude)
        ) ||
        !Number.isFinite(
            Number(parkingSpot.longitude)
        )
    ) {

        return;

    }


    const parkingIcon =
        L.divIcon({

            className:
                "parking-map-icon",

            html:
                `<div class="parking-map-dot">
                    <img
                        src="/static/icons/van.webp"
                        alt="Your car">
                </div>`,

            iconSize: [30, 30],

            iconAnchor: [14, 14]

        });


    const parkingMarker =
        L.marker(

            [
                Number(parkingSpot.latitude),
                Number(parkingSpot.longitude)
            ],

            {
                icon:
                    parkingIcon,

                zIndexOffset:
                    2000,

                keyboard:
                    false,

                title:
                    "Your Parking Spot"
            }

        ).addTo(map);


    parkingMarker.on(
        "click",
        function(e) {

            L.DomEvent.stopPropagation(e);

            showParkingDistance(
                map,
                parkingMarker,
                parkingSpot
            );

        }
    );


    return parkingMarker;

}

async function loadParking() {

    await window.cacheReady;

    console.log("loadParking()");

    const content = document.getElementById("content");

    try {
        const html = `
            <div class="parking-page">
                <div class="ticket-header">
                    <img
                        class="ticket-header-bg"
                        src="/static/icons/ticket_fill_pplf.png"
                        alt="ticket">
                    <div class="ticket-header-content">
                        <div class="ticket-header-logo">
                            <img src="/static/icons/van.webp" alt="van">
                        </div>
                        <div class="ticket-header-text">
                            <div class="ticket-header-title">
                                Festival Parking
                            </div>
                            <div class="ticket-header-subtitle">
                                Mark Your Spot as You Start Your Great Purple Day!
                            </div>
                        </div>
                        <div class="ticket-header-date">
                            9/19-20, 2026
                        </div>
                    </div>
                </div>
            </div>

<div class="ui-card">
    <div class="ui-card-media">
      <img src="/static/icons/van.webp" alt="van">
    </div>
    <div class="ui-card-content">
        <div class="ui-card-title">
            Visitor Parking
        </div>
        <div class="ui-card-body">
            <p>
                <b>Parking is FREE</b>
            </p>
            <p>
                Parking is managed by Palmyra Community Center, who
                benefit from this event.
            </p>
                <ul style="padding-left: 1rem; margin-left: 0;">
                    <li>Volunteers will guide you to your spot</li>
                    <li>Wind down window to hear directions</li>
                    <li>Field parking is not good for low or luxury vehicles</li>
                    <li><b>NO</b> parking on the road</li>
                    <li>Come from the North for handicap parking</li>
                    <li>Please have your handicap tag visible</li>
                    <li>Golf cart shuttle service is available</li>
                </ul>
        </div>
    </div>
</div>

<div class="ui-card">
    <div class="ui-card-media">
      <img src="/static/icons/van.webp" alt=van>
    </div>
    <div class="ui-card-content">
        <div class="ui-card-title">
            No Smoking or Pets Please
        </div>
        <div class="ui-card-body">
            <p>
                This is a no smoking or vaping event held on private property. Please leave those items and your pets at home. Thanks!
            </p>
        </div>
    </div>
</div>

<div class="ui-card">
    <div class="ui-card-media">
      <img src="/static/icons/van.webp" alt="van">
    </div>
    <div class="ui-card-content">
        <div class="ui-card-title">
            Mark Your Spot
        </div>
        <div class="ui-card-body">
            <p>
                <b>Tap below to mark your parking spot</b>
            </p>
            <p>
                Check the <b>Map</b> above when you leave for location and distance!
            </p>
        </div>
    </div>
</div>

<div>
<br>
</div>

<button
    id="parking-mark-button"
    class="map-button"
    type="button"
    onclick="markParkingSpot()">

    Mark My Parking Spot

</button>


<div
    id="parking-status"
    class="parking-status">
</div>

        `;

        await CacheManager.renderHtml(content, html);
        scrollToContent();

    } catch (err) {

        console.error("Parking failed to load:", err);

        content.innerHTML =
            `<div class="card">
                Updating info. Drag down to refresh.
            </div>`;
    }
}

// ---------------- STATIC PAGE LOADER ----------------
async function loadStatic(page){

  const content = document.getElementById("content");

  console.log("loadStatic()", page);

  try {

let html = null;

const cachedPages = [
  "directions",
  "faqs",
  "firstaid",
  "facilities",
  "about",
  "times",
  "demos"
];

if (cachedPages.includes(page)) {

  html = await CacheManager.getResourceHtml(
    page
  );

  if (!html) {

    content.innerHTML =
      `<div class="card">${page} page is loading. Drag down to refresh.</div>`;

    return;
  }

  console.log(
    `Loading ${page} from IndexedDB`
  );

} else {

  const version = window.APP_VERSION;

  const res = await fetch(
    `/static/pages/${page}.html?v=${version}`
  );

  html = await res.text();

  console.log(
    `Loading ${page} from server`
  );
}

    let titleMap = {
      midway: "Midway Rides & Entertainment",
      facilities: "Restroom <br>Facilities",
      tickets: "Ticket Information",
      faqs: "Frequently Asked Questions",
      about: "About the Festival",
      directions: "Directions",
      firstaid: "First Aid Station",
      times: "Start Your Day Here",
      demos: "Live Demos",
      parade: 'Fair Parade',
      exhibits: 'Judged Exhibits',
      tasting: 'Beer & Wine Tasting',
      preview: 'Preview Map'
    };

    let title = titleMap[page] || '';

    let subTitleMap = {
      tickets: "Buy Online or at the Fair",
      exhibits: "Agriculture, Domestics, Animals and Much More",
      about: "Sat-Sun Sept 19-20, 2026",
      times: "Have a Great Purple Day",
      demos: "Seen and Learn About New DIY Upcycling Products",
      directions: "The Best Way to a Great Purple Day!!",
      parade: 'Saturday, August 15th 4PM',
      tasting: 'Gourmet Food & Drink from Across the Finger Lakes'
    };

    let subTitle = subTitleMap[page] || '';

    let searchBox = '';

    if (page === 'faqs'){
      searchBox = `
        <input
          type="text"
          placeholder="Search FAQs..."
          class="faq-search"
          oninput="filterFAQs(this.value)"
        >
      `;
    }

await CacheManager.renderHtml(content, `

<div class="ticket-header">

  <img
    class="ticket-header-bg"
    src="/static/icons/ticket_fill_pplf.png"
    alt="">

  <div class="ticket-header-content">

    <div class="ticket-header-logo">
      <img src="/static/icons/van.webp" alt="">
    </div>

    <div class="ticket-header-text">

      <div class="ticket-header-title">
        ${title}
      </div>

      <div class="ticket-header-subtitle">
        ${subTitle}
      </div>

    </div>

    <div class="ticket-header-date">
      9/19-20, 2026
    </div>

  </div>

</div>

      ${searchBox}

      ${html}
    `);

    if (page === "about") {
        await loadDiagnostics();
    }

    scrollToContent();

  } catch (err) {

  console.error(
    "loadStatic failed:",
    page,
    err
  );

  content.innerHTML =
    `<div class="card">Not available. Try refresh page.</div>`;
}
}

// ---------------- TENANT LIST LOADER ----------------
async function loadTenants(type){

  const content = document.getElementById("content");

  try {
    const tenantRecord =
      await CacheManager.getResource(type);

    const tenantVersion =
      tenantRecord?.version || 1;

    const data =
      tenantRecord?.data;

    if (!data) {

      content.innerHTML =
        `<div class="card">Data is loading. Drag down to refresh.</div>`;

      return;
    }

    let titleMap = {
      food: "Food & Beverage",
      community: "Community Booths",
      vendor: "Artisan Booths",
      animal: "Animal Exhibits"
    };

    let subTitleMap = {
      food: "Food Trucks, Vendors & Specialty Drinks for All",
      community: "Organizations Helping Us All",
      vendor: "Hand-Made Art, Gifts, Crafts & Much More",
      animal: "Displays, Judging and Fun for the Whole Family"
    };

let h = `
<div class="ticket-header">

  <img
    class="ticket-header-bg"
    src="/static/icons/ticket_fill_pplf.png"
    alt="">

  <div class="ticket-header-content">

    <div class="ticket-header-logo">
      <img src="/static/icons/van.webp" alt="">
    </div>

    <div class="ticket-header-text">

      <div class="ticket-header-title">
        ${titleMap[type] || type}
      </div>

      <div class="ticket-header-subtitle">
        ${subTitleMap[type] || type}
      </div>

    </div>

    <div class="ticket-header-date">
      9/19-20, 2026
    </div>

  </div>

</div>
`;

    data.forEach(item => {

    const iconPath = item.icon
      ? `${item.icon}?v=${item.icon_version}`
      : null;

      const featuredClass = item.featured == 1
        ? 'style="background:#f4e7d3; border:2px solid #8b5a2b;"'
        : '';

      h += `
        <div class="ui-card" ${featuredClass}>

          ${iconPath ? `
            <div class="ui-card-media">
              <img src="${iconPath}" />
            </div>
          ` : ``}

          <div class="ui-card-content">
            <div class="ui-card-title">${item.name}</div>
            ${renderLine(item.description)}
            ${renderLine(item.location)}
            ${renderLine(item.times)}
          </div>

        </div>
      `;
    });

    await CacheManager.renderHtml(content, h);
    scrollToContent();

  } catch (err){
    content.innerHTML = `<div class="card">Updating info. Drag down to refresh.</div>`;
  }
}

// ---------------- SPONSORS LOADER ----------------
async function loadSponsors(){

  const content = document.getElementById("content");

  try {
const sponsorRecord =
  await CacheManager.getResource(
    "sponsors"
  );

const sponsorVersion =
  sponsorRecord?.version || 1;

const data =
  sponsorRecord?.data;

if (!data) {

  content.innerHTML =
    `<div class="card">Sponsors are loading. Drag down to refresh.</div>`;

  return;
}

console.log(
  "Loading sponsors from IndexedDB"
);

let h = `
<div class="ticket-header">

  <img
    class="ticket-header-bg"
    src="/static/icons/ticket_fill_pplf.png"
    alt="">

  <div class="ticket-header-content">

    <div class="ticket-header-logo">
      <img src="/static/icons/van.webp" alt="">
    </div>

    <div class="ticket-header-text">

      <div class="ticket-header-title">
        Festival Sponsors
      </div>

      <div class="ticket-header-subtitle">
        Please Support Our Great Sponsors
      </div>

    </div>

    <div class="ticket-header-date">
      9/19-20, 2026
    </div>

  </div>

</div>
`;

    let currentTierOrder = 0;

    data.forEach(item => {

        if (item.tier_order !== currentTierOrder){
              currentTierOrder = item.tier_order;
              h += `
                <h2
                  style="margin-top:20px;"
                >
                  <b>${item.tier}</b>
                </h2>
              `;
            }

        const iconPath = item.icon
            ? `${item.icon}?v=${item.icon_version}`
            : null;

      h += `
        <div class="ui-card">

          ${iconPath ? `
            <div class="ui-card-media">
              <img src="${iconPath}" />
            </div>
          ` : ``}

          <div class="ui-card-content">
            <div class="ui-card-title">${item.name}</div>

            ${renderLine(item.description)}

            <div class="ui-card-actions">
                <button
                    class="alert-btn"
                    onclick="window.location.href='${item.website}';">
                        Visit Website
                </button>
            </div>

          </div>

        </div>
      `;
    });

    await CacheManager.renderHtml(content, h);
    scrollToContent();

  } catch (err){
    content.innerHTML = `<div class="card">Updating info. Drag down to refresh.</div>`;
  }
}

// ---------------- EVENTS LOADER ----------------
async function loadEvents(type){

  const content = document.getElementById("content");

  try {

const eventRecord =
  await CacheManager.getResource(
    "events"
  );

const eventVersion =
  eventRecord?.version || 1;

const allEvents =
  eventRecord?.data;

if (!allEvents) {

  content.innerHTML =
    `<div class="card">Events are loading. Drag down to refresh.</div>`;

  return;
}

let data = allEvents;
if (!type || type === "calendar") {

  data = allEvents;

}
else if (type === "music") {

  data = allEvents.filter(
    item => item.type === "Music"
  );

}
else if (type === "grandstand") {

  data = allEvents.filter(
    item => item.type === "Grandstand"
  );

}
else if (type === "today") {

  const todayString =
    new Date().toISOString().slice(0, 10);

  data = allEvents.filter(item => {

    if (!item.start_datetime) {
      return false;
    }

    return item.start_datetime
      .slice(0, 10) === todayString;

  });

}

    let titleMap = {
      today: "Today's Events",
      music: "Musical Entertainment",
      grandstand: "Grandstand Events",
      calendar: "Fair Calendar"
    };

    let subTitleMap = {
      today: "Happening Today. Get Reminder Notifications for Your Favorites",
      music: "All Entertainment is Free",
      grandstand: "Buy Tickets Online or at the Grandstand",
      calendar: "A Full Week of Shows and Events"
    };

// determine title and subtitle

    let title = titleMap[type] || titleMap["calendar"];
    let subTitle = subTitleMap[type] || subTitleMap["calendar"];

let h = `
<div class="ticket-header">

  <img
    class="ticket-header-bg"
    src="/static/icons/ticket_fill_pplf.png"
    alt="">

  <div class="ticket-header-content">

    <div class="ticket-header-logo">
      <img src="/static/icons/van.webp" alt="">
    </div>

    <div class="ticket-header-text">

      <div class="ticket-header-title">
        ${title}
      </div>

      <div class="ticket-header-subtitle">
        ${subTitle}
      </div>

    </div>

    <div class="ticket-header-date">
      9/19-20, 2026
    </div>

  </div>

</div>
`;

    let currentDay = '';
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });

    data.forEach(item => {

      // ---------------- GROUP BY DAY ----------------
    if (item.day_date !== currentDay){
      currentDay = item.day_date;

      // remove commas/ordinals for comparison
      const normalizedCurrent = currentDay
        .replace(/,/g, '')
        .replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1');

      const normalizedToday = today.replace(/,/g, '');

      const scrollTag =
        normalizedCurrent.includes(normalizedToday)
          ? 'data-scroll-day="today"'
          : '';

      h += `
        <h2
          style="margin-top:20px;"
          ${scrollTag}
        >
          <b>${currentDay}</b>
        </h2>
      `;
    }

      // ---------------- ICON ----------------
const iconPath = item.icon
  ? `${item.icon}?v=${item.icon_version}`
  : null;

      // ---------------- CARD COLOR LOGIC ----------------
        let bgStyle = '';

        if (item.status === 'cancelled'){
          bgStyle = 'style="background:#fdecea; border:2px solid #c62828;"'; // dark red
        }
        else if (item.status === 'changed'){
          bgStyle = 'style="background:#fff8dc; border:2px solid #e6c200;"'; // dark yellow
        }
        else if (item.featured == 1){
          bgStyle = 'style="background:#f4e7d3; border:2px solid #8b5a2b;"'; // dark brown
        }

      // ---------------- TIME RANGE ----------------
      const timeRange = item.start_time && item.end_time
        ? `${item.start_time} - ${item.end_time}`
        : '';

    // ---------------- BUTTON LOGIC ----------------

    // event already ended?
    const eventEnded =
      item.end_datetime &&
      new Date(item.end_datetime) < new Date();

    // paid grandstand event?

    const showTicketButton =
      item.location &&
      item.location.toLowerCase().includes("grandstand") &&
      item.price &&
      item.price.toLowerCase() !== "free" &&
      !eventEnded;

    // allow alerts only for today's future events
    const showAlertButton =
      type === "today" &&
      !eventEnded;

    // existing alert state
    const alertActive =
      alertSet.has(item.event_id);

    h += `
      <div class="ui-card event-card" ${bgStyle}>

        ${iconPath ? `
          <div class="ui-card-media">
            <img src="${iconPath}" />
          </div>
        ` : ``}

        <div class="ui-card-content">
          <div class="ui-card-title">${item.name}</div>

          ${renderLine(item.description)}

          <div class="ui-card-body"><b>${item.price || ''}</b></div>

          ${renderLine(item.location)}

          ${renderLine(timeRange)}

        </div>

    ${(showTicketButton || showAlertButton) ? `
      <div class="ui-card-actions stacked-actions">

        ${showTicketButton ? `
          <button
            class="alert-btn"
            onclick="window.open(
              'https://www.etix.com/ticket/v/29262/wayne-county-fair-palmyra-ny',
              '_blank'
            )"
          >
            Buy Tickets
          </button>
        ` : ``}

        ${showAlertButton ? `
          <button
            class="alert-btn ${alertActive ? 'active' : ''}"
            onclick="toggleAlert(${item.event_id}, this)"
          >
            ${alertActive ? 'Alert Set' : 'Alert Me'}
          </button>
        ` : ``}

      </div>
    ` : ``}

      </div>
    `;
    });

    await CacheManager.renderHtml(content, h);

    // 🔥 SMART CALENDAR SCROLL
    if (!type){

      const todayEl = document.querySelector('[data-scroll-day="today"]');

    function scrollWithOffset(el){

      const offset = 12;

      const targetY =
        el.getBoundingClientRect().top
        + window.pageYOffset
        - offset;

      const startY = window.pageYOffset;
      const distance = targetY - startY;

      const duration = 2400; // milliseconds (adjust to taste)

      let startTime = null;

      function easeInOutQuad(t){
        return t < 0.5
          ? 2 * t * t
          : 1 - Math.pow(-2 * t + 2, 2) / 2;
      }

      function animateScroll(currentTime){

        if (!startTime){
          startTime = currentTime;
        }

        const elapsed = currentTime - startTime;

        const progress = Math.min(elapsed / duration, 1);

        const eased = easeInOutQuad(progress);

        window.scrollTo(
          0,
          startY + (distance * eased)
        );

        if (progress < 1){
          requestAnimationFrame(animateScroll);
        }
      }

      requestAnimationFrame(animateScroll);
    }

      if (todayEl){
        scrollWithOffset(todayEl);
      } else {
        scrollToContent();
      }

    } else {
      scrollToContent();
    }

  } catch (err){
    content.innerHTML = `<div class="card">Updating info. Drag down to refresh.</div>`;
  }
}

// ---------------- VOTE ---------------
async function loadVotePage(){

  const content = document.getElementById("content");

    const todayNow = new Date();
    const today =
        `${todayNow.getFullYear()}-${
            String(todayNow.getMonth()+1).padStart(2,'0')
        }-${
            String(todayNow.getDate()).padStart(2,'0')
        }`;

    const voteKey =
      `vote_submitted_${deviceId}_${today}`;

    let voted =
      await CacheManager.getMetadata(
        voteKey
      );

    if (voted) {
      loadVoteResults();
      return;
    }

const vendors =
  await CacheManager.getResourceData(
    "vendors"
  ) || [];

const food =
  vendors.filter(
    x => x.vendor_type === "food"
  );

const music =
  vendors.filter(
    x => x.vendor_type === "music"
  );

const artisan =
  vendors.filter(
    x => x.vendor_type === "artisan"
  );

  // store globally for picker
  window.voteData = { food, music, artisan };

    function renderCard(label, category, icon){

      const selected = voteSelection[category];

      let name = "&lt;None Selected&gt;";

      if (selected){
        const found = voteData[category].find(x => x.vendor_id === selected);
        if (found){
          name = found.vendor_name;
        }
      }

    return `
      <div class="ui-card vote-card">

        <div class="ui-card-media">
          <img src="/static/icons/vote/1stribbon.webp">
        </div>

        <div class="ui-card-content">

          <div class="ui-card-title">${label}</div>

          <div class="ui-card-body"></div>   <!-- blank line -->

          <div class="ui-card-body ${selected ? '' : 'placeholder'}">
            ${name}
          </div>

        </div>

        <div class="ui-card-actions">
          <button
            class="alert-btn ${selected ? 'active' : ''}"
            onclick="openVotePicker('${category}')"
          >
            ${selected ? 'Change' : 'Pick'}
          </button>
        </div>

      </div>
    `;
    }

  await CacheManager.renderHtml(content, `

<div class="ticket-header">

  <img
    class="ticket-header-bg"
    src="/static/icons/ticket_fill_pplf.png"
    alt="">

  <div class="ticket-header-content">

    <div class="ticket-header-logo">
      <img src="/static/icons/van.webp" alt="">
    </div>

    <div class="ticket-header-text">

      <div class="ticket-header-title">
        Best of Festival
      </div>

      <div class="ticket-header-subtitle">
        Vote Once a Day to See Rankings
      </div>

    </div>

    <div class="ticket-header-date">
      9/19-20, 2026
    </div>

  </div>

</div>

    ${renderCard("Pick Best Food", "food", "food")}
    ${renderCard("Pick Best Artist Booth", "artisan", "artisan")}
    ${renderCard("Pick Best Music", "music", "music")}

    <button class="vote-submit-btn" onclick="submitVote()">Submit Your Votes</button>
  `);

  scrollToContent();
}

setTimeout(() => {
  toggleVoteSection('food');
}, 100);

let voteSelection = {
  food: null,
  artisan: null,
  music: null
};

function selectVote(category, id, el){

  voteSelection[category] = id;

  document.querySelectorAll(`#vote-${category} .vote-option`)
    .forEach(x => x.classList.remove("selected"));

  el.classList.add("selected");
}

async function submitVote(){

  const hasSelection =
    voteSelection.food ||
    voteSelection.artisan ||
    voteSelection.music;

  if (!hasSelection){
    alert("Please pick at least one category");
    return;
  }

  if (!confirm("Tap OK to submit your vote today.")) return;

    const votePayload = {
      device_id: deviceId,
      votes: voteSelection
    };

    await CacheManager.queueVote({
      payload: votePayload,
      created: Date.now()
    });

    const todayNow = new Date();
    const today =
        `${todayNow.getFullYear()}-${
            String(todayNow.getMonth()+1).padStart(2,'0')
        }-${
            String(todayNow.getDate()).padStart(2,'0')
        }`;

    const voteKey =
      `vote_submitted_${deviceId}_${today}`;

    await CacheManager.setMetadata(
      voteKey,
      true
    );

    loadVoteResults();

}

async function loadVoteResults(){

  const content = document.getElementById("content");

let data =
  await CacheManager.getMetadata(
    "vote_results"
  );

const resultTime =
  await CacheManager.getMetadata(
    "vote_results_time"
  );

if (
  !resultTime ||
  (Date.now() - resultTime) > 300000
) {

  try {

    await CacheManager.refreshVoteResults();

    data =
      await CacheManager.getMetadata(
        "vote_results"
      );

  } catch (err) {

    console.warn(
      "Using cached vote results"
    );

  }
}

const updatedTime =
  await CacheManager.getMetadata(
    "vote_results_time"
  );

const ts = updatedTime
  ? new Date(updatedTime)
      .toLocaleString()
  : "Not Available";

  function renderCard(title, icon, list){

    return `
      <div class="ui-card vote-result-card">

        <div class="ui-card-media">
          <img src="/static/icons/vote/1stribbon.webp">
        </div>

        <div class="ui-card-content">

          <div class="vote-result-header">
            <div class="vote-result-title">${title}</div>
            <div class="vote-result-votes">Votes</div>
          </div>

          ${list.map((x,i)=>`
<div class="vote-result-row">

  <div class="vote-rank">
    ${ordinal(i+1)}
  </div>

  <div class="vote-result-name">
    ${x.vendor_name}
  </div>

  <div class="vote-result-count">
    ${x.vote_count}
  </div>

</div>
          `).join('')}

        </div>

      </div>
    `;
  }

await CacheManager.renderHtml(content, `

<div class="ticket-header">

  <img
    class="ticket-header-bg"
    src="/static/icons/ticket_fill_pplf.png"
    alt="">

  <div class="ticket-header-content">

    <div class="ticket-header-logo">
      <img src="/static/icons/van.webp" alt="">
    </div>

    <div class="ticket-header-text">

      <div class="ticket-header-title">
        Thanks for Voting
      </div>

      <div class="ticket-header-subtitle">
        Vote Daily Through 9/20!
      </div>

    </div>

    <div class="ticket-header-date">
      9/19-20, 2026
    </div>

  </div>

</div>

  <h2 class="vote-results-heading">Rankings Updated <br>${ts}</h2>

  ${renderCard("Best Food", "food", data.food)}
  ${renderCard("Best Artisan Booth", "artisan", data.artisan)}
  ${renderCard("Best Music", "music", data.music)}

`);

  scrollToContent();
}

async function refreshVoteResults(){

  // save current scroll position
  const scrollPos = window.scrollY;

  const content = document.getElementById("content");

    const data =
      await CacheManager.getMetadata(
        "vote_results"
      ) || {
        food: [],
        artisan: [],
        music: []
      };

    const resultTime =
      await CacheManager.getMetadata(
        "vote_results_time"
      );

    const ts = resultTime
      ? new Date(resultTime)
          .toLocaleString()
      : "Not Available";

  function renderCard(title, icon, list){
    return `
      <div class="ui-card vote-result-card">

        <div class="ui-card-media">
          <img src="/static/icons/vote/1stribbon.webp">
        </div>

        <div class="ui-card-content">

          <div class="vote-result-header">
            <div class="vote-result-title">${title}</div>
            <div class="vote-result-votes">Votes</div>
          </div>

          ${list.map((x,i)=>`
<div class="vote-result-row">

  <div class="vote-rank">
    ${ordinal(i+1)}
  </div>

  <div class="vote-result-name">
    ${x.vendor_name}
  </div>

  <div class="vote-result-count">
    ${x.vote_count}
  </div>

</div>
          `).join('')}

        </div>

      </div>
    `;
  }

await CacheManager.renderHtml(content, `

<div class="ticket-header">

  <img
    class="ticket-header-bg"
    src="/static/icons/ticket_fill_pplf.png"
    alt="">

  <div class="ticket-header-content">

    <div class="ticket-header-logo">
      <img src="/static/icons/van.webp" alt="">
    </div>

    <div class="ticket-header-text">

      <div class="ticket-header-title">
        Thanks for Voting
      </div>

      <div class="ticket-header-subtitle">
        Voting has closed<br>Thank you to everyone!
      </div>

    </div>

    <div class="ticket-header-date">
      9/19-20, 2026
    </div>

  </div>

</div>

    <h2 class="vote-results-heading">Ranking at ${ts}</h2>

    ${renderCard("Best Food", "food", data.food)}
    ${renderCard("Best Artisan", "artist", data.artisan)}
    ${renderCard("Best Music", "music", data.music)}
  `);

  // 🔥 restore exact scroll position
  window.scrollTo(0, scrollPos);
}

// ---------------- SURVEY -------------
async function loadSurvey(){

const localSubmitted =
  await CacheManager.getMetadata(
    "survey_submitted"
  );

if (localSubmitted) {

  await renderSurveyThankYou();

  return;
}

let h = `
<div class="ticket-header">

  <img
    class="ticket-header-bg"
    src="/static/icons/ticket_fill_pplf.png"
    alt="">

  <div class="ticket-header-content">

    <div class="ticket-header-logo">
      <img src="/static/icons/van.webp" alt="">
    </div>

    <div class="ticket-header-text">

      <div class="ticket-header-title">
        Free Coffee Coupon
      </div>

      <div class="ticket-header-subtitle">
        Click & Get Your Coupon
      </div>

    </div>

    <div class="ticket-header-date">
      9/19-20, 2026
    </div>

  </div>

</div>
`;

  surveyConfig.forEach(q => {

    h += `
      <div class="ui-card">

        <div class="ui-card-media">
          <img src="/static/icons/van.webp" />
        </div>

        <div class="ui-card-content">
          <div class="ui-card-title">${q.question}</div>
          <div class="ui-card-body">(Pick up to ${q.max})</div>

          <div class="survey-options">
            ${q.options.map(o => `
              <button class="survey-btn"
                onclick="toggleSurvey(${q.id}, ${o.id}, ${q.max}, this)">
                ${o.label}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  });

  h += `
    <div class="ui-card">

      <div class="ui-card-media">
        <img src="/static/icons/van.webp" />
      </div>

      <div class="ui-card-content">
        <div class="ui-card-title">Comments?</div>
        <textarea class="survey-comment"
          oninput="updateSurveyComment(this.value)"></textarea>
      </div>
    </div>

    <button id="surveySubmitBtn" class="vote-submit-btn" disabled onclick="submitSurvey()">
      Get Your Free Coffee Coupon
    </button>
  `;

  await CacheManager.renderHtml(content, h);
  scrollToContent();
}

function toggleSurvey(qid, aid, max, btn){

  if (!surveyAnswers[qid]){
    surveyAnswers[qid] = new Set();
  }

  const set = surveyAnswers[qid];

  if (set.has(aid)){
    set.delete(aid);
    btn.classList.remove("active");
  }
  else {
    if (set.size >= max) return;

    if (max === 1){
      set.clear();
      document.querySelectorAll(`[onclick^="toggleSurvey(${qid},"]`)
        .forEach(b => b.classList.remove("active"));
    }

    set.add(aid);
    btn.classList.add("active");
  }

  updateSurveySubmit();
}

function updateSurveyComment(val){
  surveyComment = val;
  updateSurveySubmit();
}

function updateSurveySubmit(){

  const hasAnswer = Object.values(surveyAnswers)
    .some(set => set.size > 0);

  const hasComment = surveyComment.trim().length > 0;

  document.getElementById("surveySubmitBtn").disabled =
    !(hasAnswer || hasComment);
}

async function submitSurvey(){

  if (!confirm("Tap OK to confirm.")) return;

  let payload = [];

  Object.entries(surveyAnswers).forEach(([qid, set]) => {
    set.forEach(aid => {
      payload.push({
        question_id: Number(qid),
        answer_id: aid
      });
    });
  });

    const surveyPayload = {
      device_id: deviceId,
      answers: payload,
      comment: surveyComment
    };

    await CacheManager.queueSurvey({
      payload: surveyPayload,
      created: Date.now()
    });

    await CacheManager.setMetadata(
      "survey_submitted",
      true
    );

    await renderSurveyThankYou();

}

async function renderSurveyThankYou(){

  const content = document.getElementById("content");

  await CacheManager.renderHtml(content, `

<div class="ticket-header">

  <img
    class="ticket-header-bg"
    src="/static/icons/ticket_fill_pplf.png"
    alt="">

  <div class="ticket-header-content">

    <div class="ticket-header-logo">
      <img src="/static/icons/van.webp" alt="">
    </div>

    <div class="ticket-header-text">

      <div class="ticket-header-title">
        Thank You!
      </div>

      <div class="ticket-header-subtitle">
        Show Your Coupon at the Purple Painted Lady Store
      </div>

    </div>

    <div class="ticket-header-date">
      9/19-20, 2026
    </div>

  </div>

</div>

      <div class="ui-card coupon-card coupon-large">

        <img src="/static/icons/van.webp" class="coupon-logo" />

        <div class="coupon-amount">FREE SMALL COFFEE</div>

        <div class="coupon-location">at</div>
        <div class="coupon-location">The Purple Painted Lady Store</div>
      <div class="coupon-location">2620 Route 31, Palmyra, NY</div>
        <div class="coupon-location"><b>Anytime After Sept 20, 2026</b></div>

        <div class="coupon-note">
          Show screen to redeem. One coffee per person.
        </div>

      </div>
    `);

  scrollToContent();
}

// ---------------- MAP ----------------
async function showMap(options = {}){

  await window.cacheReady;

  const content = document.getElementById("content");

  /*
   * ------------------------------------------------------------
   * Preserve the existing Purple ticket header EXACTLY.
   * ------------------------------------------------------------
   */

  content.innerHTML = `

<div class="ticket-header">

  <img
    class="ticket-header-bg"
    src="/static/icons/ticket_fill_pplf.png"
    alt="">

  <div class="ticket-header-content">

    <div class="ticket-header-logo">
      <img src="/static/icons/van.webp" alt="">
    </div>

    <div class="ticket-header-text">

      <div class="ticket-header-title">
        Festival Map
      </div>

      <div class="ticket-header-subtitle">
        <span style="font-size: 1em;">
          Pinch/spread to explore. <br>Red dot is your location.
        </span>
      </div>

    </div>

    <div class="ticket-header-date">
      9/19-20, 2026
    </div>

  </div>

</div>

<div id="gpsStatus" class="gps-status">
  Location Dot Will Appear When at Festival
</div>

<div id="galleryMap"></div>

  `;


  /*
   * ------------------------------------------------------------
   * Preserve the special Explore -> Map behavior.
   * ------------------------------------------------------------
   */

  if (options.instantScroll){

    const contentEl =
      document.getElementById("content");

    if (contentEl){

      const y =
        contentEl.getBoundingClientRect().top +
        window.pageYOffset -
        12;

      window.scrollTo({
        top: y,
        behavior: "auto"
      });

    }

  } else {

    scrollToContent();

  }


  /*
   * ------------------------------------------------------------
   * Load the Purple festival data from IndexedDB.
   * ------------------------------------------------------------
   */

  const vendorRecord =
    await CacheManager.getResource("vendors");

  const boothRecord =
    await CacheManager.getResource("booths");

  const zoneRecord =
    await CacheManager.getResource("zones");

  const utilityRecord =
    await CacheManager.getResource("utilities");


const vendors =
  vendorRecord?.data || [];

const booths =
  boothRecord?.data || [];

const zones =
  zoneRecord?.data || [];

const utilities =
  utilityRecord?.data || [];

/*
 * The zones resource comes from the server as JSON.
 * vertices may therefore still be a JSON string when it
 * reaches IndexedDB. Convert it back into the array of
 * [lat, lon] pairs expected by Leaflet.
 */
zones.forEach(zone => {

  if (typeof zone.vertices === "string") {

    try {

      zone.vertices =
        JSON.parse(zone.vertices);

    } catch (err) {

      console.error(
        "Unable to parse zone vertices:",
        zone.zone_id,
        zone.vertices,
        err
      );

      zone.vertices = [];

    }

  }

});

  /*
   * ------------------------------------------------------------
   * Map image.
   *
   * Use the media cache first so the map continues to work
   * offline just like the rest of the Purple app.
   * ------------------------------------------------------------
   */

  const mapImage =
    await CacheManager.getMediaUrl(
      "/static/maps/festival_map.webp"
    ) || "/static/maps/festival_map.webp";


  /*
   * ------------------------------------------------------------
   * Determine the actual image dimensions.
   *
   * This avoids hard-coding the dimensions of festival_map.png.
   * ------------------------------------------------------------
   */

  const imageDimensions =
    await new Promise((resolve, reject) => {

      const img = new Image();

      img.onload = () => {

        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });

      };

      img.onerror = () => {
        reject(
          new Error(
            "Unable to load festival map image."
          )
        );
      };

      img.src = mapImage;

    });


  const imageWidth =
    imageDimensions.width;

  const imageHeight =
    imageDimensions.height;


  /*
   * ------------------------------------------------------------
   * Leaflet map.
   *
   * Keep the existing CRS.Simple approach because the map
   * itself is an image and the GPS coordinates are converted
   * into image coordinates below.
   * ------------------------------------------------------------
   */

const MAP_BOUNDS = {
  north: 43.042796,
  south: 43.039288,
  west: -77.259882,
  east: -77.252055
};

const imageBounds =
  L.latLngBounds([
    [MAP_BOUNDS.south, MAP_BOUNDS.west],
    [MAP_BOUNDS.north, MAP_BOUNDS.east]
  ]);

const map =
  L.map("galleryMap", {
    crs: L.CRS.EPSG3857,
    minZoom: 0,
    maxZoom: 23,
    zoomSnap: 0.25,
    zoomDelta: 0.75,
    attributionControl: false,
    maxBoundsViscosity: 1.0,
    tap: true
  });

  /*
   * ------------------------------------------------------------
   * GPS marker.
   *
   * This is the same marker used by the existing Purple map.
   * ------------------------------------------------------------
   */

  const gpsMarker =
    L.circleMarker(
      [0, 0],
      {
        radius: 10,

        color: "#ffffff",

        weight: 2,

        opacity: 0.5,

        fillColor: "#ff0000",

        fillOpacity: 0.5
      }
    );


  let gpsVisible = false;


  /*
   * ------------------------------------------------------------
   * Image coordinate bounds.
   * ------------------------------------------------------------
   */

const bounds = imageBounds;


  /*
   * ------------------------------------------------------------
   * Festival map image.
   * ------------------------------------------------------------
   */

  L.imageOverlay(
    mapImage,
    bounds,
    {
      interactive: false
    }
  ).addTo(map);

map.setMaxBounds(
  imageBounds
);

/*
 * ------------------------------------------------------------
 * Fixed festival utility markers.
 *
 * Utilities use inline SVG symbols rather than image files.
 * This keeps the markers small, consistent, and fully offline.
 * Each utility uses the color supplied by the database.
 * ------------------------------------------------------------
 */

const UTILITY_LABELS = {
  tent: "Tent",
  first_aid: "First Aid",
  atm: "ATM",
  restroom: "Restroom",
  seating: "Seating",
  ticket: "Tickets",
  info: "Information",
  music: "Music",
  trash: "Trash",
  shuttle: "Shuttle"
};

function utilitySymbol(type){

  const common =
    'viewBox="0 0 24 24" aria-hidden="true"';

  switch(type){

    case "tent":
      return `<svg ${common} class="utility-svg">
        <path d="M3 20L12 4l9 16M6 20h12M8.5 14h7"/>
      </svg>`;

    case "first_aid":
      return `<svg ${common} class="utility-svg">
        <path d="M12 4v16M4 12h16"/>
      </svg>`;

    case "atm":
      return `<svg ${common} class="utility-svg">
        <path d="M12 3v18M16 7.5c-.8-1-2-1.5-3.7-1.5-2 0-3.3 1-3.3 2.5 0 3.8 7 1.7 7 5.5 0 1.5-1.4 2.5-3.6 2.5-1.7 0-3-.5-4-1.5"/>
      </svg>`;

case "restroom":
  return `<svg ${common} class="utility-svg utility-wc">
    <text x="12" y="16" text-anchor="middle">R</text>
  </svg>`;

    case "seating":
      return `<svg ${common} class="utility-svg">
        <path d="M7 5v8M7 13h10M17 9v4M7 13v6M17 13v6M7 5h5a3 3 0 0 1 3 3v1"/>
      </svg>`;

    case "ticket":
      return `<svg ${common} class="utility-svg">
        <path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V7z"/>
        <path d="M10 7v12"/>
      </svg>`;

    case "info":
      return `<svg ${common} class="utility-svg">
        <circle cx="12" cy="12" r="8"/>
        <path d="M12 10v6M12 7.5v.5"/>
      </svg>`;

    case "music":
      return `<svg ${common} class="utility-svg">
        <path d="M9 18V6l9-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM18 16a3 3 0 1 1-3-3"/>
      </svg>`;

    case "trash":
      return `<svg ${common} class="utility-svg">
        <path d="M6 7h12l-1 14H7L6 7zM9 7V4h6v3M4 7h16M10 11v6M14 11v6"/>
      </svg>`;

    case "shuttle":
      return `<svg ${common} class="utility-svg">
        <path d="M5 17V8c0-2 1.5-3 3.5-3h7C17.5 5 19 6 19 8v9H5zM5 12h14M8 17v2M16 17v2M8 9h3M14 9h3"/>
        <circle cx="8" cy="17" r="1.5"/>
        <circle cx="16" cy="17" r="1.5"/>
      </svg>`;

    default:
      return `<svg ${common} class="utility-svg">
        <circle cx="12" cy="12" r="8"/>
      </svg>`;
  }
}

const utilityMarkerRecords = [];

function utilityRadiusFor(lat, zoom){
  /*
   * Utilities intentionally scale more slowly than vendor booths.
   * At the widest map view they are only slightly larger than
   * the smallest vendor dots, then grow as the user zooms in.
   */
  const vendorRadius = dotRadiusFor(lat, zoom);

  return Math.max(
    5,
    Math.min(
      vendorRadius * 1.5,
      14
    )
  );
}

function refreshUtilityScaling(){

  const zoom = map.getZoom();

  utilityMarkerRecords.forEach(
    record => {

      const radius =
        utilityRadiusFor(
          record.lat,
          zoom
        );

      const size =
        Math.round(
          radius * 2
        );

      record.marker.setIcon(
        L.divIcon({
          className: "utility-map-icon",

          html:
            `<div class="utility-map-dot"
                  style="background:${record.color}">
                ${utilitySymbol(record.type)}
             </div>`,

          iconSize: [
            size,
            size
          ],

          iconAnchor: [
            radius,
            radius
          ]
        })
      );

    }
  );
}

function addUtilityMarkers(){

  utilities.forEach(
    utility => {

      const lat =
        Number(
          utility.latitude
        );

      const lon =
        Number(
          utility.longitude
        );

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ){
        return;
      }

      const type =
        String(
          utility.utility_type || ""
        ).toLowerCase();

      const color =
        utility.color ||
        "#5c249c";

      utilityMarkerRecords.push({
        marker: null,
        lat: lat,
        lon: lon,
        type: type,
        color: color
      });

    }
  );

  /*
   * Create the markers at the current map zoom.
   */
  utilityMarkerRecords.forEach(
    record => {

      const radius =
        utilityRadiusFor(
          record.lat,
          map.getZoom()
        );

      const size =
        Math.round(
          radius * 2
        );

      const marker =
        L.marker(
          [
            record.lat,
            record.lon
          ],
          {
            icon:
              L.divIcon({
                className:
                  "utility-map-icon",

                html:
                  `<div class="utility-map-dot"
                        style="background:${record.color}">
                      ${utilitySymbol(record.type)}
                   </div>`,

                iconSize: [
                  size,
                  size
                ],

                iconAnchor: [
                  radius,
                  radius
                ]
              }),

            keyboard: false,

            title:
              utilities.find(
                u =>
                  Number(u.latitude) === record.lat &&
                  Number(u.longitude) === record.lon
              )?.utility_name ||
              UTILITY_LABELS[record.type] ||
              "Festival Utility",

            zIndexOffset: 1500
          }
        ).addTo(map);

      record.marker = marker;

      marker.on(
        "click",
        function(e){

          L.DomEvent.stop(e);

          const utility =
            utilities.find(
              u =>
                Number(u.latitude) === record.lat &&
                Number(u.longitude) === record.lon
            );

          marker.bindPopup(
            `<div class="utility-popup">
               <div class="utility-popup-title">
                 ${escapeHtml(
                   utility?.utility_name ||
                   UTILITY_LABELS[record.type] ||
                   "Festival Utility"
                 )}
               </div>
             </div>`,
            {
              className:
                "utility-popup-container",

              maxWidth: 220,

              closeButton: true
            }
          ).openPopup();

        }
      );

    }
  );

}

/*
 * Draw all fixed utility locations on the map.
 * They remain visible regardless of which vendor zone is active.
 */

let mapFitZoom = 0;

function computeWholeMapZoom(){

  const rect =
    document
      .getElementById(
        "galleryMap"
      )
      .getBoundingClientRect();

  const refZoom = 0;

  const nw =
    map.project(
      imageBounds.getNorthWest(),
      refZoom
    );

  const se =
    map.project(
      imageBounds.getSouthEast(),
      refZoom
    );

  const imageHeightPx =
    Math.abs(
      se.y - nw.y
    );

  const scaleY =
    rect.height /
    imageHeightPx;

  return map.getScaleZoom(
    scaleY,
    refZoom
  );
}

function fitWholeMap(){

  mapFitZoom =
    computeWholeMapZoom();

  map.setMinZoom(
    mapFitZoom
  );

  const rect =
    document
      .getElementById(
        "galleryMap"
      )
      .getBoundingClientRect();

  const nw =
    map.project(
      imageBounds.getNorthWest(),
      mapFitZoom
    );

  const se =
    map.project(
      imageBounds.getSouthEast(),
      mapFitZoom
    );

  /*
   * Position the viewport so that the
   * LEFT edge of the map image is
   * aligned with the LEFT edge of
   * the viewing window.
   */

  const targetX =
    nw.x +
    (rect.width / 2);

  const targetY =
    (nw.y + se.y) / 2;

  const targetCenter =
    map.unproject(
      L.point(
        targetX,
        targetY
      ),
      mapFitZoom
    );

  map._resetView(
    targetCenter,
    mapFitZoom
  );
}

  /*
   * ------------------------------------------------------------
   * GPS boundary check.
   * ------------------------------------------------------------
   */

  const LAT_TOL = 0.0005;

  const LON_TOL = 0.0005;


  function isInside(lat, lon){

    return (

      lat <=
        MAP_BOUNDS.north + LAT_TOL

      &&

      lat >=
        MAP_BOUNDS.south - LAT_TOL

      &&

      lon >=
        MAP_BOUNDS.west - LON_TOL

      &&

      lon <=
        MAP_BOUNDS.east + LON_TOL

    );

  }


  /*
   * ------------------------------------------------------------
   * Existing GPS smoothing.
   * ------------------------------------------------------------
   */

  let filteredLat = null;

  let filteredLon = null;


  const GPS_ALPHA = 0.45;


  function smoothPosition(lat, lon){

    if (filteredLat === null){

      filteredLat = lat;

      filteredLon = lon;

    } else {

      filteredLat =
        (GPS_ALPHA * lat) +
        ((1 - GPS_ALPHA) * filteredLat);


      filteredLon =
        (GPS_ALPHA * lon) +
        ((1 - GPS_ALPHA) * filteredLon);

    }


    return {

      lat: filteredLat,

      lon: filteredLon

    };

  }


  /*
   * ------------------------------------------------------------
   * Existing GPS movement filter.
   * ------------------------------------------------------------
   */

  let lastLat = null;

  let lastLon = null;


  function hasMovedEnough(lat, lon){

    if (!lastLat) {
      return true;
    }


    const dist =
      Math.sqrt(

        Math.pow(
          lat - lastLat,
          2
        )

        +

        Math.pow(
          lon - lastLon,
          2
        )

      );


    return dist > 0.00002;

  }


  /*
   * ------------------------------------------------------------
   * GPS display logic.
   *
   * This is deliberately kept equivalent to the existing logic.
   * ------------------------------------------------------------
   */

  const GPS_HIDE_ACCURACY_FT = 200;

  const GPS_LOW_ACCURACY_FT = 150;


  function getGpsRadius(accuracyFt){

    // Purple map GPS dot is intentionally smaller than the Fair map.
    if (accuracyFt < 20) return 10;

    if (accuracyFt < 50) return 15;

    if (accuracyFt < 100) return 20;

    if (accuracyFt < 150) return 25;

    return 30;

  }


  /*
   * There is now only one map view.
   *
   * Keep this as "fair" so the existing GPS logic remains
   * unchanged rather than introducing a new GPS path.
   */

  let currentView = "fair";


  if ("geolocation" in navigator){

gpsWatchId =
  navigator.geolocation.watchPosition(
    (pos) => {

      const lat =
        TEST_GPS_ENABLED
          ? TEST_GPS_LAT
          : pos.coords.latitude;

      const lon =
        TEST_GPS_ENABLED
          ? TEST_GPS_LON
          : pos.coords.longitude;

      const accuracyMeters =
        TEST_GPS_ENABLED
          ? TEST_GPS_ACCURACY_FEET / 3.28084
          : (pos.coords.accuracy || 9999);


          const accuracyFt =
            Math.round(
              accuracyMeters * 3.28084
            );


          const gpsStatus =
            document.getElementById(
              "gpsStatus"
            );


          if (!gpsStatus){
            return;
          }


          if (
            accuracyFt >
            GPS_HIDE_ACCURACY_FT
          ){

            gpsStatus.innerHTML =
              "GPS Location Not Currently Available";


            if (gpsVisible){

              map.removeLayer(
                gpsMarker
              );

              gpsVisible = false;

            }

            return;

          }


          if (
            accuracyFt >=
            GPS_LOW_ACCURACY_FT
          ){

            gpsStatus.textContent =
              `GPS Accuracy: ±${accuracyFt} ft (Low Accuracy)`;

          } else {

            gpsStatus.textContent =
              `GPS Accuracy: ±${accuracyFt} ft`;

          }


          if (!isInside(lat, lon)){

            gpsStatus.innerHTML =
              "Location Dot Will Appear When at Festival";


            if (gpsVisible){

              map.removeLayer(
                gpsMarker
              );

              gpsVisible = false;

            }

            return;

          }


          if (
            !hasMovedEnough(
              lat,
              lon
            )
          ){

            return;

          }


          lastLat = lat;

          lastLon = lon;


          const smooth =
            smoothPosition(
              lat,
              lon
            );

        const point =
          L.latLng(
            smooth.lat,
            smooth.lon
          );


          gpsMarker.setRadius(
            getGpsRadius(
              accuracyFt
            )
          );


          gpsMarker.setLatLng(
            point
          );


          if (
            currentView !== "fair"
          ){

            if (gpsVisible){

              map.removeLayer(
                gpsMarker
              );

              gpsVisible = false;

            }

            return;

          }


          if (!gpsVisible){

            gpsMarker.addTo(map);

            gpsVisible = true;

          }

        },


        (err) => {

          console.log(
            "GPS error:",
            err
          );


          const gpsStatus =
            document.getElementById(
              "gpsStatus"
            );


          if (gpsStatus){

            gpsStatus.innerHTML =
              "Location Dot Will Appear When at Festival";

          }


          if (gpsVisible){

            map.removeLayer(
              gpsMarker
            );

            gpsVisible = false;

          }

        },


        {

          enableHighAccuracy: true,

          maximumAge: 1000,

          timeout: 10000

        }

      );

  }


  /*
   * ------------------------------------------------------------
   * Map behavior from festival_map.html prototype.
   * ------------------------------------------------------------
   */


  function textColorFor(hexColor){

    let c =
      String(hexColor || "")
        .replace("#", "");


    if (c.length === 3){

      c =
        c
          .split("")
          .map(
            ch => ch + ch
          )
          .join("");

    }


    const r =
      parseInt(
        c.substr(0, 2),
        16
      ) / 255;


    const g =
      parseInt(
        c.substr(2, 2),
        16
      ) / 255;


    const b =
      parseInt(
        c.substr(4, 2),
        16
      ) / 255;


    const lum =
      0.2126 * r +
      0.7152 * g +
      0.0722 * b;


    return lum > 0.6
      ? "#15161a"
      : "#ffffff";

  }


  function polygonCentroid(vertices){

    const pts =
      vertices.slice();


    if (pts.length > 1){

      const first =
        pts[0];

      const last =
        pts[pts.length - 1];


      if (
        first[0] === last[0] &&
        first[1] === last[1]
      ){

        pts.pop();

      }

    }


    let latSum = 0;

    let lngSum = 0;


    for (
      let i = 0;
      i < pts.length;
      i++
    ){

      latSum += pts[i][0];

      lngSum += pts[i][1];

    }


    return [

      latSum / pts.length,

      lngSum / pts.length

    ];

  }


  /*
   * Booth marker sizing from prototype.
   */

  const BOOTH_FEET = 10;

  const BOOTH_METERS =
    BOOTH_FEET * 0.3048;

  const DOT_DIAMETER_SCALE = 0.9;

  const MIN_DOT_RADIUS = 4;

  const MAX_DOT_RADIUS = 60;

  const HIT_PADDING_PX = 10;

  const MIN_HIT_RADIUS = 16;

  const LABEL_MIN_ZOOM_OFFSET = 3.2;


  function metersPerPixel(lat, zoom){

    return (
      156543.03392 *
      Math.cos(
        lat * Math.PI / 180
      ) /
      Math.pow(
        2,
        zoom
      )
    );

  }


  function dotRadiusFor(lat, zoom){

    const mpp =
      metersPerPixel(
        lat,
        zoom
      );


    const r =
      (
        BOOTH_METERS *
        DOT_DIAMETER_SCALE /
        2
      ) / mpp;


    return Math.max(
      MIN_DOT_RADIUS,
      Math.min(
        r,
        MAX_DOT_RADIUS
      )
    );

  }

 addUtilityMarkers();


  function cleanBoothNumber(value){

    return (
      value || ""
    )
      .toString()
      .trim()
      .replace(
        /,\s*$/,
        ""
      );

  }


  /*
   * ------------------------------------------------------------
   * Favorites.
   *
   * Use the SAME IndexedDB favorites used by Explore.
   * ------------------------------------------------------------
   */

  let favoriteVendorIds =
    new Set();


  /*
   * Count favorites by vendor zone.
   *
   * This deliberately counts vendors rather than booths,
   * matching the prototype behavior.
   */

function computeFavoriteCountsByZone(){

  const counts = {};

  const favoriteIds =
    new Set(
      Array.from(
        favoriteVendorIds
      ).map(
        id => String(id)
      )
    );

  Object.keys(
    boothsByZone
  ).forEach(
    zoneId => {

      const favoriteVendors =
        new Set();

      boothsByZone[
        zoneId
      ].forEach(
        booth => {

          if (
            favoriteIds.has(
              String(
                booth.vendor_id
              )
            )
          ){
            favoriteVendors.add(
              String(
                booth.vendor_id
              )
            );
          }

        }
      );

      if (
        favoriteVendors.size > 0
      ){
        counts[zoneId] =
          favoriteVendors.size;
      }

    }
  );

  return counts;
}

  function escapeHtml(value){

    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  }


  function zoneButtonHtml(
    zone,
    favoriteCount
  ){

    let label =
      escapeHtml(
        zone.zone_name
      );


    if (favoriteCount > 0){

      label +=
        " (" +
        favoriteCount +
        ")";

    }


    return `
      <div
        class="zone-btn"
        style="
          background:${zone.zone_color};
          color:${textColorFor(zone.zone_color)};
        "
      >
        ${label}
      </div>
    `;

  }


  /*
   * ------------------------------------------------------------
   * Zone state.
   * ------------------------------------------------------------
   */

  const zoneState = {};


  /*
   * ------------------------------------------------------------
   * Build the vendor lookup.
   * ------------------------------------------------------------
   */

  const vendorById = {};


  vendors.forEach(
    vendor => {

      vendorById[
        vendor.vendor_id
      ] = vendor;

    }
  );


  /*
   * Booths grouped by zone.
   */

  const boothsByZone = {};


  booths.forEach(
    booth => {

      if (
        !boothsByZone[
          booth.zone_id
        ]
      ){

        boothsByZone[
          booth.zone_id
        ] = [];

      }


      boothsByZone[
        booth.zone_id
      ].push(
        booth
      );

    }
  );


  /*
   * ------------------------------------------------------------
   * Build zone polygons and labels.
   * ------------------------------------------------------------
   */

  function buildZones(
    favoriteCountsByZone
  ){

    zones.forEach(
      zone => {

        if (
          !Array.isArray(
            zone.vertices
          )
          ||
          zone.vertices.length < 3
        ){

          return;

        }

const centroid =
  polygonCentroid(
    zone.vertices
  );

const polygon =
  L.polygon(
    zone.vertices,
            {
              color:
                zone.zone_color,
              weight: 2,

              opacity: 0.95,

              fill: true,

              fillColor:
                zone.zone_color,

              fillOpacity: 0.06,

              interactive: true,

              bubblingMouseEvents: false

            }
          ).addTo(map);


        const buttonIcon =
          L.divIcon({

            className:
              "zone-btn-wrap",

            html:
              zoneButtonHtml(
                zone,
                favoriteCountsByZone[
                  zone.zone_id
                ] || 0
              ),

            iconSize: [0, 0],

            iconAnchor: [0, 0]

          });


        const button =
          L.marker(
            centroid,
            {

              icon:
                buttonIcon,

              interactive: true,

              keyboard: false,

              zIndexOffset: 500

            }
          ).addTo(map);


        const state = {

          zone: zone,

          centroid: centroid,

          button: button,

          polygon: polygon,

          vendorLayers: [],

          active: false

        };


        zoneState[
          zone.zone_id
        ] = state;


        function onActivate(e){

          if (e){

            L.DomEvent.stop(e);

          }


          map.closePopup();


          activateZone(
            zone.zone_id
          );

        }


        polygon.on(
          "click",
          onActivate
        );


        button.on(
          "click",
          onActivate
        );

      }
    );

  }


  /*
   * ------------------------------------------------------------
   * Build vendor dots for a zone only when the zone is opened.
   * ------------------------------------------------------------
   */

  function buildVendorLayers(
    zoneId
  ){

    const state =
      zoneState[zoneId];


    if (
      !state ||
      state.vendorLayers.length
    ){

      return;

    }


    const list =
      boothsByZone[
        zoneId
      ] || [];


    const color =
      state.zone.zone_color;


    list.forEach(
      booth => {

        const vendor =
          vendorById[
            booth.vendor_id
          ];


        if (!vendor){

          return;

        }

    const latlng =
      L.latLng(
        Number(booth.latitude),
        Number(booth.longitude)
      );

        const radius =
          dotRadiusFor(
            booth.latitude,
            map.getZoom()
          );


        /*
         * Invisible larger hit target.
         */

        const hit =
          L.circleMarker(
            latlng,
            {

              radius:
                Math.max(
                  radius +
                    HIT_PADDING_PX,
                  MIN_HIT_RADIUS
                ),

              stroke: false,

              fill: true,

              fillOpacity: 0.001,

              interactive: true,

              bubblingMouseEvents: false,

              pane: "markerPane"

            }
          );


        /*
         * Visible booth dot.
         *
         * Favorite booths get the white outline.
         */

        const isFavorite =
          favoriteVendorIds.has(
            vendor.vendor_id
          );


        const dot =
          L.circleMarker(
            latlng,
            {

              radius: radius,

              color:
                isFavorite
                  ? "#ffffff"
                  : "#111214",

              weight:
                isFavorite
                  ? 3.75
                  : 1.5,

              opacity: 1,

              fill: true,

              fillColor: color,

              fillOpacity: 0.95,

              interactive: false,

              pane: "markerPane"

            }
          );


        /*
         * Booth number displayed directly in the center of the dot.
         * Uses display_order from the booth data (0-99).
         */
        const boothNumber =
          booth.display_order !== null &&
          booth.display_order !== undefined &&
          String(booth.display_order).trim() !== ""
            ? String(booth.display_order).trim()
            : "";

        const numberLabel =
          boothNumber
            ? L.marker(
                latlng,
                {
                  icon: L.divIcon({
                    className: "booth-number-label",
                    html:
                      `<span>${escapeHtml(boothNumber)}</span>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                  }),
                  interactive: false,
                  keyboard: false,
                  // Keep booth numbers above every booth dot.
                  zIndexOffset: 10000
                }
              )
            : null;


        const layerRecord = {

          vendor: vendor,

          booth: booth,

          hit: hit,

          dot: dot,

          numberLabel: numberLabel,

          numberSpan: null,

          radius: radius,

          labelOn: false

        };


        hit.on(
          "click",
          (e) => {

            L.DomEvent.stop(e);

            openVendorPopup(
              layerRecord
            );

          }
        );


        state.vendorLayers.push(
          layerRecord
        );

      }
    );

  }


  /*
   * ------------------------------------------------------------
   * Vendor popup from prototype.
   * ------------------------------------------------------------
   */

   function openVendorPopup(
    layerRecord
  ){

    const vendor =
      layerRecord.vendor;


    const booth =
      layerRecord.booth;


    const state =
      zoneState[
        booth.zone_id
      ];


    const color =
      state.zone.zone_color;


    const textColor =
      textColorFor(
        color
      );


    const boothNumber =
      cleanBoothNumber(
        booth.booth_number
      );


    const products = [
      vendor.featured_product_1,
      vendor.featured_product_2,
      vendor.featured_product_3
    ].filter(product =>
      product !== null &&
      product !== undefined &&
      String(product).trim() !== ""
    );


    let productsHtml = "";


    if (products.length > 0) {

      productsHtml =
        '<div class="vendor-popup-products">' +
          '<div class="vendor-popup-products-title">' +
            'Featured Products' +
          '</div>' +
          products.map(product =>
            '<div class="vendor-popup-product">' +
              '• ' +
              escapeHtml(
                String(product).trim()
              ) +
            '</div>'
          ).join("") +
        '</div>';

    }


    const html =
      '<div class="vendor-popup-inner">' +

        '<div class="vendor-popup-name">' +
          escapeHtml(
            vendor.vendor_name
          ) +
        '</div>' +

        (
          boothNumber
            ?
              '<div class="vendor-popup-booth" ' +
                'style="' +
                  'background:' +
                  color +
                  ';color:' +
                  textColor +
                ';">' +
                escapeHtml(
                  boothNumber
                ) +
              '</div>'
            :
              ""
        ) +

        '<p class="vendor-popup-desc">' +
          escapeHtml(
            vendor.description || ""
          ) +
        '</p>' +

        productsHtml +

      '</div>';


    L.popup({

      className:
        "vendor-popup",

      closeButton: true,

      autoClose: true,

      closeOnClick: false,

      maxWidth: 280,

      minWidth: 250,

      offset: [
        0,
        -layerRecord.radius
      ]

    })

      .setLatLng(
        L.latLng(
          Number(booth.latitude),
          Number(booth.longitude)
        )
      )

      .setContent(
        html
      )

      .openOn(map);

  }


  /*
   * ------------------------------------------------------------
   * Activate one zone.
   * ------------------------------------------------------------
   */

  function activateZone(
    zoneId
  ){

    Object.keys(
      zoneState
    ).forEach(
      id => {

        const state =
          zoneState[id];


        if (
          Number(id) ===
          Number(zoneId)
        ){

          if (
            state.active
          ){

            return;

          }


          buildVendorLayers(
            state.zone.zone_id
          );


          map.removeLayer(
            state.button
          );


          state.vendorLayers.forEach(
            layerRecord => {

              layerRecord.hit.addTo(
                map
              );

              layerRecord.dot.addTo(
                map
              );

              if (layerRecord.numberLabel) {
                layerRecord.numberLabel.addTo(
                  map
                );

                const numberElement =
                  layerRecord.numberLabel.getElement();

                layerRecord.numberSpan =
                  numberElement
                    ? numberElement.querySelector("span")
                    : null;
              }

            }
          );


          state.active = true;

        }

        else if (
          state.active
        ){

          deactivateZoneState(
            state
          );

        }

      }
    );


    refreshVendorScaling();

  }


  function deactivateZoneState(
    state
  ){

    state.vendorLayers.forEach(
      layerRecord => {

        if (
          map.hasLayer(
            layerRecord.hit
          )
        ){

          map.removeLayer(
            layerRecord.hit
          );

        }


        if (
          map.hasLayer(
            layerRecord.dot
          )
        ){

          map.removeLayer(
            layerRecord.dot
          );

        }


        if (
          layerRecord.numberLabel &&
          map.hasLayer(
            layerRecord.numberLabel
          )
        ){

          map.removeLayer(
            layerRecord.numberLabel
          );

        }

        layerRecord.numberSpan =
          null;


        if (
          layerRecord.labelOn
        ){

          layerRecord.dot.unbindTooltip();

          layerRecord.labelOn =
            false;

        }

      }
    );


    if (
      !map.hasLayer(
        state.button
      )
    ){

      state.button.addTo(
        map
      );

    }


    state.active = false;

  }


  function deactivateAllZones(){

    Object.keys(
      zoneState
    ).forEach(
      id => {

        const state =
          zoneState[id];


        if (
          state.active
        ){

          deactivateZoneState(
            state
          );

        }

      }
    );

  }


  /*
   * ------------------------------------------------------------
   * Vendor scaling and name labels.
   * ------------------------------------------------------------
   */

 function refreshVendorScaling(){

  const zoom =
    map.getZoom();

  const baseZoomForLabels =
    mapFitZoom +
    LABEL_MIN_ZOOM_OFFSET;

  const showLabels =
    zoom >=
    baseZoomForLabels;


    Object.keys(
      zoneState
    ).forEach(
      id => {

        const state =
          zoneState[id];


        if (
          !state.active
        ){

          return;

        }


        state.vendorLayers.forEach(
          layerRecord => {

            const radius =
              dotRadiusFor(
                layerRecord.booth.latitude,
                zoom
              );


            layerRecord.radius =
              radius;


            layerRecord.dot.setRadius(
              radius
            );

            if (layerRecord.numberSpan) {
              layerRecord.numberSpan.style.setProperty(
                "--booth-number-scale",
                String(radius / 18)
              );
            }


            layerRecord.hit.setRadius(
              Math.max(
                radius +
                  HIT_PADDING_PX,
                MIN_HIT_RADIUS
              )
            );


            if (
              showLabels &&
              !layerRecord.labelOn
            ){

              layerRecord.dot
                .bindTooltip(
                  escapeHtml(
                    layerRecord.vendor.vendor_name
                  ),
                  {

                    permanent: true,

                    direction: "center",

                    className:
                      "vendor-label"

                  }
                )
                .openTooltip();


              layerRecord.labelOn =
                true;

            }

            else if (
              !showLabels &&
              layerRecord.labelOn
            ){

              layerRecord.dot
                .unbindTooltip();


              layerRecord.labelOn =
                false;

            }

          }
        );

      }
    );

  }


  /*
   * ------------------------------------------------------------
   * Blank map tap returns to zone view.
   * ------------------------------------------------------------
   */

  map.on(
    "click",
    () => {

      map.closePopup();

      deactivateAllZones();

    }
  );

map.on(
  "zoomend",
  () => {
    refreshVendorScaling();
    refreshUtilityScaling();
  }
);

  /*
   * ------------------------------------------------------------
   * Keep the map correctly sized when the page layout changes.
   * ------------------------------------------------------------
   */

let userHasZoomedOrPanned = false;

map.on(
  "zoomstart dragstart",
  function(){
    userHasZoomedOrPanned = true;
  }
);

function resyncMapSize(){

  const mapElement =
    document.getElementById(
      "galleryMap"
    );

  if (!mapElement){
    return;
  }


  map.invalidateSize({
    animate: false
  });


  if (
    !userHasZoomedOrPanned
  ){
    fitWholeMap();
  }
  else {
    map.setMinZoom(
      computeWholeMapZoom()
    );
  }
}

fitWholeMap();

if (
  "ResizeObserver" in window
){

  const mapElement =
    document.getElementById(
      "galleryMap"
    );

  const mapResizeObserver =
    new ResizeObserver(
      function(){
        resyncMapSize();
      }
    );

  mapResizeObserver.observe(
    mapElement
  );

}
else {

  window.addEventListener(
    "resize",
    resyncMapSize
  );

}


  /*
   * ------------------------------------------------------------
   * Load the SAME favorite IDs used by Explore before drawing
   * the zone buttons.
   *
   * favorites_db.js already supplies this function.
   * ------------------------------------------------------------
   */

  try {

    const ids =
      await loadFavoriteIdsFromDB();


    favoriteVendorIds =
      new Set(ids);

  }

  catch (err){

    console.error(
      "Could not load favorites for festival map:",
      err
    );


    favoriteVendorIds =
      new Set();

  }


  /*
   * ------------------------------------------------------------
   * Draw the zones after favorites have been loaded so the
   * favorite counts appear immediately.
   * ------------------------------------------------------------
   */

  buildZones(
    computeFavoriteCountsByZone()
  );


  /*
   * ------------------------------------------------------------
   * Restore the visitor's saved parking spot.
   * ------------------------------------------------------------
   */

  await addParkingMarkerToMap(
    map
  );

}

// ---------------- PAGE ROUTER ----------------
async function loadPage(page, options = {}){

    if (todayRefreshTimer){
      clearInterval(todayRefreshTimer);
      todayRefreshTimer = null;
    }

    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }


  // 🔴 Preserve "More row" behavior
// 🔥 HANDLE MORE ROW VISIBILITY (supports multiple rows)
if (page !== "more"){

  // check if clicked item exists in ANY more-row
  const isMoreRowButton = document.querySelector(
    `.more-row[data-page="${page}"]`
  );

  // if NOT part of expanded rows → collapse all
  if (!isMoreRowButton){
    document.querySelectorAll(".more-row").forEach(el => {
      el.style.display = "none";
    });
  }
}

  // ---------------- STATIC PAGES ----------------
  const staticPages = {
    directions: "directions",
    facilities: "facilities",
    faqs: "faqs",
    about: "about",
    firstaid: "firstaid",
    times: "times",
    demos: "demos"
  };

  if (staticPages[page]){
    loadStatic(staticPages[page]);
    return;
  }

  // ---------------- SPONSORS ----------------
  if (page === "sponsors"){
    loadSponsors();
    return;
  }

// ---------------- EVENTS PAGES ----------------
if (page === "music"){
  loadEvents("music");
  return;
}

// -------------- SURVEY ---------------
if (page === "survey"){
  loadSurvey();
  return;
}

// ---------------- MAP ----------------
if (page === "map"){
  showMap(options);
  return;
}

// --------------- VOTE ----------------
if (page === "vote"){
  loadVotePage();
  return;
}

// --------------- ARTIST ----------------
if (page === "artist"){
  loadExplore();
  return;
}

// --------------- PARK ----------------
if (page === "parking"){
  loadParking();
  return;
}


  // ---------------- EVERYTHING ELSE (DISABLED FOR NOW) ----------------
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="card">
      Feature coming soon
    </div>
  `;
}

// ---------------- MENU BINDING ----------------
document.querySelectorAll(".icon-card").forEach(card => {

  const page = card.dataset.page;
  if (!page) return;

card.addEventListener("click", () => {

CacheManager.queueAnalytics({
  event: "menu_click",
  value: page,
  device_id: deviceId,
  timestamp: Date.now()
});

  loadPage(page);
});
});

// ---------------- GLOBAL SETTINGS ----------------

// Disable long-press context menu (mobile UX)
document.addEventListener("contextmenu", e => e.preventDefault());

//------------ TODAY EVENTS AND NOTIFICATIONS -------------
async function initSubscription(){

  try {

    if (!('serviceWorker' in navigator)) return;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

    if (!sub) return;

    const endpoint = sub.endpoint;

    const res = await fetch('/api/get_sub_id', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ endpoint })
    });

    const id = Number(await res.json());

    if (id > 0){
      subscriptionId = id;
      pushAuthorized = true;

    const cached =
      await CacheManager.getMetadata(
        `alerts_${subscriptionId}`
      );

    alertSet =
      new Set(cached || []);

    }

  } catch (err){
    console.error("initSubscription failed:", err);
    // 🔥 DO NOT THROW — fail silently
  }
}


async function subscribeUser(){

    // 🍎 block invalid Apple usage
    if (isApple && !isStandalone){
      alert("Install the app first: Share → Add to Home Screen");
      return;
    }

  try {

    const reg = await navigator.serviceWorker.ready;

    // 🔥 STEP 1: check existing subscription
    let sub = await reg.pushManager.getSubscription();

    // 🔥 STEP 2: only create if missing
    if (!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    console.log("SUB OBJECT:", sub);

    const json = sub.toJSON();

    const payload = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth
      }
    };

    console.log("PAYLOAD:", payload);

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    console.log("SERVER RESPONSE:", result);

    subscriptionId = Number(result);

    // 🔥 IMPORTANT: only mark authorized if backend succeeded
    if (subscriptionId > 0){
      pushAuthorized = true;
    } else {
      throw new Error("Subscription not saved on server");
    }

    // reload alerts
    const a = await fetch(`/api/alerts/${subscriptionId}`);
    const ids = await a.json();
    alertSet = new Set(ids);
    await CacheManager.setMetadata(
      `alerts_${subscriptionId}`,
      ids
    );

    // 🔥 FORCE UI refresh
    loadTodayEvents();

  } catch (err){
    console.error("SUBSCRIBE FAILED:", err);
    alert("Subscription failed. Try again.");
  }
}

function renderPushCard(){

  // already subscribed → no card
  if (pushAuthorized) return '';

    if (isApple && !isStandalone){
      return `
        <div class="ui-card push-card ios-note">

          <div class="push-title">
            Stay Updated
          </div>

          <div class="push-text">
            Install this app to enable notifications.
          </div>

          <div class="push-action">
            <button class="alert-btn" onclick="installApp()">
              Install App
            </button>
          </div>

        </div>
      `;
    }

  // ✅ Normal case (Android OR iOS installed)
  return `
    <div class="ui-card push-card">

      <div class="push-title">
        Stay Updated
      </div>

      <div class="push-text">
        Tap Enable Notifications. If blocked, check browser settings.
      </div>

      <div class="push-action">
        <button class="alert-btn" onclick="subscribeUser()">
          Enable Notifications
        </button>
      </div>

    </div>
  `;
}

async function loadTodayEvents(preserveScroll = false){

    const content = document.getElementById("content");
    let scrollPos = 0;
    if (preserveScroll){
      scrollPos = window.scrollY;
    }

    // stop any existing timer first
    if (todayRefreshTimer){
      clearInterval(todayRefreshTimer);
    }

  try {

    // 🔥 ENSURE subscription + alerts are ready
    if (!pushAuthorized && subscriptionId === 0){
      await initSubscription();
    }

    const eventRecord =
      await CacheManager.getResource("events");

    const allEvents =
      eventRecord?.data || [];

    const todayNow = new Date();

    // Opening day of the fair
    const openingDay = new Date(2026, 7, 10);   // August 10, 2026 (month is 0-based)

    // Use opening day until the fair actually begins
    const displayDate =
        (todayNow < openingDay) ? openingDay : todayNow;

    const todayString =
        `${displayDate.getFullYear()}-${
            String(displayDate.getMonth() + 1).padStart(2, '0')
        }-${
            String(displayDate.getDate()).padStart(2, '0')
        }`;

    const data =
      allEvents.filter(item =>
        item.start_datetime?.slice(0,10) === todayString
      );

let h = `
<div class="ticket-header">

  <img
    class="ticket-header-bg"
    src="/static/icons/ticket_fill_pplf.png"
    alt="">

  <div class="ticket-header-content">

    <div class="ticket-header-logo">
      <img src="/static/icons/van.webp" alt="">
    </div>

    <div class="ticket-header-text">

      <div class="ticket-header-title">
        Today's Events
      </div>

      <div class="ticket-header-subtitle">
        Set Alerts for Your Favorites
      </div>

    </div>

    <div class="ticket-header-date">
      9/19-20, 2026
    </div>

  </div>

</div>
`;


    h += renderPushCard();

    const now = new Date();
    let currentDay = '';

    data.forEach(item => {

        if (item.day_date !== currentDay){
          currentDay = item.day_date;

          h += `<h2 style="margin-top:20px;"><b>${currentDay}</b></h2>`;
        }

    const iconPath = item.icon
        ? `${item.icon}?v=${item.icon_version}`
        : null;

      let bgStyle = '';

      // ---------- BASE STATUS (unchanged logic) ----------
      if (item.status === 'cancelled'){
        bgStyle = 'style="background:#fdecea; border:2px solid #c62828;"';
      }
      else if (item.status === 'changed'){
        bgStyle = 'style="background:#fff8dc; border:2px solid #e6c200;"';
      }
      else if (item.featured == 1){
        bgStyle = 'style="background:#f4e7d3; border:2px solid #8b5a2b;"';
      }

      // ---------- REAL TIME CALC ----------
      const start = new Date(item.start_datetime);
      const end = new Date(item.end_datetime);

      const diffMin = Math.floor((start - now) / 60000);

      let statusLine = '';

      if (item.status !== 'cancelled') {
        if (diffMin <= 90 && diffMin > 0){
          statusLine = `Event starts in ${diffMin} minutes`;
        }
        else if (now >= start && now <= end){
          statusLine = 'Happening Now';
          bgStyle = 'style="background:#e8f5e9; border:2px solid #2e7d32;"';
        }
        else if (now > end){
          statusLine = 'Ended';
        }
      }

      // ---------- ALERT BUTTON RULES ----------
      let showButton = false;

      if (
          pushAuthorized &&
          diffMin > 15 &&
          now < start &&
          item.status !== 'cancelled'
      ){
        showButton = true;
      }

      const hasAlert = alertSet.has(item.event_id);

    // ---------- TICKET BUTTON RULES ----------
    const showTicketButton =
      item.location &&
      item.location.toLowerCase().includes("grandstand") &&
      item.price &&
      item.price.toLowerCase() !== "free" &&
      now < end;

      const timeRange = `${item.start_time} - ${item.end_time}`;

            let scrollTag = '';

            if (item.status !== 'cancelled') {
              if (now >= start && now <= end){
                scrollTag = 'data-scroll="now"';
              }
              else if (now < start && !scrollTag){
                scrollTag = 'data-scroll="next"';
              }
            }

            h += `
              <div class="ui-card" ${bgStyle} ${scrollTag}>

            ${iconPath ? `
              <div class="ui-card-media">
                <img src="${iconPath}" />
              </div>
            ` : ``}

            <div class="ui-card-content">
              <div class="ui-card-title">${item.name}</div>

              ${renderLine(item.description)}
              <div class="ui-card-body"><b>${item.price || ''}</b></div>
              ${renderLine(item.location)}
              ${renderLine(timeRange)}

              ${statusLine ? `
                <div class="ui-card-body"><b>${statusLine}</b></div>
              ` : ''}
            </div>

    ${(showButton || showTicketButton) ? `
      <div class="ui-card-actions stacked-actions">

        ${showTicketButton ? `
          <button
            class="alert-btn"
            onclick="window.open(
              'https://www.etix.com/ticket/v/29262/wayne-county-fair-palmyra-ny',
              '_blank'
            )"
          >
            Buy Tickets
          </button>
        ` : ''}

        ${showButton ? `
          <button
            class="alert-btn ${hasAlert ? 'active' : ''}"
            onclick="toggleAlert(${item.event_id}, this)">
            ${hasAlert ? 'Remove Alert' : 'Alert Me'}
          </button>
        ` : ''}

      </div>
    ` : ''}

          </div>
        `;
    });

  await CacheManager.renderHtml(content, h);

// 🔥 SMART SCROLL (only on first load + ONLY if subscribed)
if (!preserveScroll){

  if (pushAuthorized){

    const nowEl = document.querySelector('[data-scroll="now"]');
    const nextEl = document.querySelector('[data-scroll="next"]');

    function scrollWithOffset(el){
      const offset = 12;

      const y = el.getBoundingClientRect().top + window.pageYOffset - offset;

      window.scrollTo({
        top: y,
        behavior: 'smooth'
      });
    }

    if (nowEl){
      scrollWithOffset(nowEl);
    }
    else if (nextEl){
      scrollWithOffset(nextEl);
    }
    else {
      scrollToContent(); // fallback
    }

  } else {
    // 🔥 NOT subscribed → always show top (push card visible)
    scrollToContent();
  }

} else {
  // preserve existing scroll during refresh
  window.scrollTo(0, scrollPos);
}

  } catch (err) {
    console.error("loadTodayEvents error:", err);
    content.innerHTML = `<div class="card">Updating info. Drag down to refresh.</div>`;
  }

// start auto refresh (once per minute)
todayRefreshTimer = setInterval(() => {
  loadTodayEvents(true);   // ✅ preserve scroll on refresh
}, 60000);

if (preserveScroll){
  window.scrollTo(0, scrollPos);
}

}

async function toggleAlert(eventId, btn){

  if (!subscriptionId || subscriptionId === 0){
    alert("Enable notifications first");
    return;
  }

  // 🔒 prevent double taps
  if (btn.disabled) return;
  btn.disabled = true;

  const hasAlert = alertSet.has(eventId);

  // ---------- OPTIMISTIC UI UPDATE ----------
  if (!hasAlert){
    alertSet.add(eventId);
    await CacheManager.setMetadata(
      `alerts_${subscriptionId}`,
      [...alertSet]
    );
    btn.innerText = "Remove Alert";
    btn.classList.add("active");
  } else {
    alertSet.delete(eventId);
    await CacheManager.setMetadata(
      `alerts_${subscriptionId}`,
      [...alertSet]
    );
    btn.innerText = "Alert Me";
    btn.classList.remove("active");
  }

  try {
    // ---------- BACKGROUND REQUEST ----------
    await CacheManager.queueAlert({

      action:
        !hasAlert
          ? "add"
          : "remove",

      subscriptionId,

      eventId,

      created:
        Date.now()

    });

  } catch (err){

    console.error("Alert toggle failed:", err);

    // ---------- ROLLBACK UI ----------
    if (!hasAlert){
      alertSet.delete(eventId);
      btn.innerText = "Alert Me";
      btn.classList.remove("active");
    } else {
      alertSet.add(eventId);
      btn.innerText = "Remove Alert";
      btn.classList.add("active");
    }

    alert("Failed to update alert. Try again.");

  } finally {
    // 🔓 re-enable after short delay (prevents spam taps)
    setTimeout(() => {
      btn.disabled = false;
    }, 1200);
  }
}

// ============================================================
// WELCOME MESSAGE
// ============================================================

const WELCOME_DISMISSED_KEY = "welcome_dismissed";

async function initializeWelcomeCard() {

  const card =
    document.getElementById("welcomeCard");

  const closeButton =
    document.getElementById("welcomeClose");

  const image =
    document.getElementById("welcomeImage");

  if (!card || !closeButton) {
    return;
  }


  // Wait until IndexedDB/cache system is ready
  await window.cacheReady;


  // Has the visitor already dismissed the welcome?
  const dismissed =
    await CacheManager.getMetadata(
      WELCOME_DISMISSED_KEY
    );


  if (dismissed) {

    card.style.display = "none";

    return;
  }


  // Load the image from the existing media cache.
  // Fall back to the normal static URL if necessary.
  if (image) {

    try {

      const cachedImage =
        await CacheManager.getMediaUrl(
          "/static/images/tricia_welcome.png"
        );

      if (cachedImage) {
        image.src = cachedImage;
      }

    } catch (err) {

      console.warn(
        "Unable to load cached welcome image:",
        err
      );

      // Leave the normal /static/images/... source intact.
    }
  }


  // Show welcome card
  card.style.display = "block";


  // Close / permanently dismiss
  closeButton.addEventListener("click", async () => {

    await CacheManager.setMetadata(
      WELCOME_DISMISSED_KEY,
      true
    );

    card.style.display = "none";

  });

}

window.addEventListener("load", async () => {

  initializeInstallUI();
  showFacebookBrowserMessage();

  // Initialize welcome message
  try {
    await initializeWelcomeCard();
  } catch (err) {
    console.warn("Welcome initialization failed", err);
  }

  // CacheManager was already initialized by the bootstrap
  try {
    await initSubscription();
  } catch (err) {
    console.warn("Subscription init failed", err);
  }

  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");

  if (page === "today"){
    loadTodayEvents();
  }
});

function filterFAQs(text){

  text = text.toLowerCase();

  const container = document.getElementById("faqContainer");
  if (!container) return;

  const cards = container.querySelectorAll(".ui-card");

  cards.forEach(card => {
    const content = card.innerText.toLowerCase();
    const match = content.includes(text);
    card.style.display = match ? "flex" : "none";
  });
}

async function installApp(){

  CacheManager.queueAnalytics({
    event: "install_tap",
    value: "install",
    device_id: deviceId,
    timestamp: Date.now()
  });

  // iPhone/iPad
  if (isApple){

    showInstallInstructions();
    return;
  }

  // Android / Chrome
  if (deferredInstallPrompt){

    deferredInstallPrompt.prompt();

    const result =
      await deferredInstallPrompt.userChoice;

    if (result.outcome === 'accepted'){

      const installUI =
        document.getElementById('installContainer');

      if (installUI){
        installUI.style.display = 'none';
      }
    }

    deferredInstallPrompt = null;
  }
}


// ---------------- TASTING LOADER ----------------
async function loadTasting(){

  const content = document.getElementById("content");

  try {

    const res = await fetch(`/api/tasting`);
    const data = await res.json();

    let h = `
      <div class="vote-thanks">Wine and Beer Tasting</div>

      <div class="vote-thanks-note">
        Thursday August 13th 5-7pm <br>Entertainment Alley
      </div>

      <div class="taste-extra">
        Tickets $15/person online or at the door
      </div>

      <div class="taste-extra">
        All attendees must be 21 or older
      </div>
    `;

    data.forEach(item => {

      const iconPath = item.icon
        ? `/static/icons/${item.icon}`
        : null;

      const featuredStyle = item.featured == 1
        ? 'style="background:#f4e7d3; border:2px solid #8b5a2b;"'
        : '';

      h += `
        <div class="ui-card taste-card" ${featuredStyle}>

          ${iconPath ? `
            <div class="ui-card-media taste-media">
              <img src="${iconPath}" />
            </div>
          ` : ``}

          <div class="ui-card-content">

            <div class="ui-card-title">
              ${item.name || ''}
            </div>

            ${renderLine(item.description)}

            <div class="ui-card-body"></div>

            ${renderLine(item.products)}

            <div class="ui-card-body"></div>

            ${renderLine(item.about)}

            <div class="ui-card-body"></div>

            ${item.website
              ? `
                <div class="ui-card-body">
                  <a
                    href="${item.website}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ${item.website}
                  </a>
                </div>
              `
              : ''
            }

          </div>

        </div>
      `;
    });

    await CacheManager.renderHtml(content, h);

    scrollToContent();

  } catch (err){

    content.innerHTML =
      `<div class="card">Error loading tasting data</div>`;
  }
}
