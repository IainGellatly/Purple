// ---------- Explore favorites persistence ----------

const EXPLORE_FAVORITES_KEY =
    "explore_favorite_vendor_ids";


async function loadFavoriteIdsFromDB() {

    try {

        const ids =
            await CacheManager.getMetadata(
                EXPLORE_FAVORITES_KEY
            );

        if (!Array.isArray(ids)) {
            return [];
        }

        return ids;

    } catch (err) {

        console.error(
            "Could not load Explore favorites:",
            err
        );

        return [];

    }
}


async function addFavoriteToDB(vendorId) {

    try {

        const ids =
            await loadFavoriteIdsFromDB();

        if (!ids.includes(vendorId)) {

            ids.push(vendorId);

            await CacheManager.setMetadata(
                EXPLORE_FAVORITES_KEY,
                ids
            );

        }

    } catch (err) {

        console.error(
            "Could not save Explore favorite:",
            err
        );

    }
}


async function removeFavoriteFromDB(vendorId) {

    try {

        const ids =
            await loadFavoriteIdsFromDB();

        const filtered =
            ids.filter(
                id => id !== vendorId
            );

        await CacheManager.setMetadata(
            EXPLORE_FAVORITES_KEY,
            filtered
        );

    } catch (err) {

        console.error(
            "Could not remove Explore favorite:",
            err
        );

    }
}