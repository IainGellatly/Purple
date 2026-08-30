// ---------- IndexedDB: favorites persistence ----------

const FAVORITES_DB_NAME = "vendorAppDB";
const FAVORITES_DB_VERSION = 1;
const FAVORITES_STORE = "favorites";

let favoritesDbPromise = null;

function openFavoritesDB() {
    if (favoritesDbPromise) return favoritesDbPromise;

    favoritesDbPromise = new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            reject(new Error("IndexedDB is not available in this browser."));
            return;
        }

        const request = indexedDB.open(FAVORITES_DB_NAME, FAVORITES_DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
                db.createObjectStore(FAVORITES_STORE, { keyPath: "vendor_id" });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });

    return favoritesDbPromise;
}

async function loadFavoriteIdsFromDB() {
    try {
        const db = await openFavoritesDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(FAVORITES_STORE, "readonly");
            const store = tx.objectStore(FAVORITES_STORE);
            const request = store.getAllKeys();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        // No persisted favorites yet, or IndexedDB unavailable (e.g. private
        // browsing). Fall back to an empty list rather than blocking startup.
        console.error("Could not load favorites from IndexedDB:", err);
        return [];
    }
}

async function addFavoriteToDB(vendorId) {
    try {
        const db = await openFavoritesDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(FAVORITES_STORE, "readwrite");
            tx.objectStore(FAVORITES_STORE).put({ vendor_id: vendorId });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error("Could not save favorite to IndexedDB:", err);
    }
}

async function removeFavoriteFromDB(vendorId) {
    try {
        const db = await openFavoritesDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(FAVORITES_STORE, "readwrite");
            tx.objectStore(FAVORITES_STORE).delete(vendorId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error("Could not remove favorite from IndexedDB:", err);
    }
}
