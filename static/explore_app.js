let miniSearch;
let searchResults = [];
let favoriteVendorIds = new Set();

let currentTab = "search";
let exploreMode = "artist";
let foodVendors = [];
let foodSearchActive = false;

// ---------- App startup ----------

async function initializeExplore(mode = "artist") {

    exploreMode = mode;
    currentTab = mode === "food" ? "trucks" : "search";
    foodSearchActive = false;

    const buttons = document.querySelectorAll(".tab-button");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            switchTab(button.dataset.tab);
        });
    });

    buildSearchIndex();

    /*
     * Food mode uses the same vendor dataset and search index,
     * but limits the displayed population to food vendors.
     */
    foodVendors = exploreVendors.filter(v =>
        ["truck", "food", "drink"].includes(
            String(v.vendor_type || "").toLowerCase()
        )
    );

    /*
     * Load previously starred vendors before the first render.
     */
    const storedFavoriteIds =
        await loadFavoriteIdsFromDB();

    favoriteVendorIds =
        new Set(storedFavoriteIds);

    const input =
        document.getElementById("virtual-input");

    input.addEventListener(
        "input",
        () => {
            performSearch(input.value);
        }
    );

    if (document.getElementById("browse-button")) {
        setupBrowse();
    }

    setupVendorDetailPopup();

    initializeExploreKeyboard();

    const mapButton =
        document.getElementById("explore-map-button");

    if (mapButton){
        mapButton.addEventListener(
            "click",
            () => loadPage("map", { instantScroll: true })
        );
    }

    performSearch("");
}
function setupBrowse() {
    const browseButton = document.getElementById("browse-button");
    const browseOverlay = document.getElementById("browse-overlay");
    const browsePopup = document.getElementById("browse-popup");
    const categoryList = document.getElementById("browse-category-list");
    const cancelButton = document.getElementById("browse-cancel");
    const input = document.getElementById("virtual-input");

    /*
     * Populate the browse list from the existing categories
     * array in explore_map_zone_vendor_booth.js.
     */
    categoryList.innerHTML = "";
    exploreCategories.forEach(categoryItem => {
        const categoryValue = categoryItem.category;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "browse-category";
        /*
         * Display a visitor-friendly version of the category,
         * while retaining the original value for searching.
         */
        button.textContent = formatCategoryLabel(categoryValue);
        button.addEventListener("click", () => {

            // Close the popup.
            closeBrowsePopup();
            // Put the selected category into the existing search field.
            input.value = categoryValue;
            /*
             * Use the exact same search function used by
             * normal typed searches.
             */
            performSearch(categoryValue);
        });

        categoryList.appendChild(button);
    });
    // Open popup.
    browseButton.addEventListener("click", openBrowsePopup);
    // Cancel button closes popup.
    cancelButton.addEventListener("click", closeBrowsePopup);
    // Tapping outside the popup also closes it.
    browseOverlay.addEventListener("click", (event) => {
        if (event.target === browseOverlay) {
            closeBrowsePopup();
        }
    });

    // Prevent clicks inside popup from closing it.
    browsePopup.addEventListener("click", (event) => {
        event.stopPropagation();
    });
}

function openBrowsePopup() {
    document
        .getElementById("browse-overlay")
        .classList.add("visible");
}

function closeBrowsePopup() {
    document
        .getElementById("browse-overlay")
        .classList.remove("visible");
}

function formatCategoryLabel(categoryValue) {
    return categoryValue
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
}

function buildSearchIndex() {
    miniSearch = new MiniSearch({
        idField: "vendor_id",
        fields: [
            "search_index"
        ],
        storeFields: [
            "vendor_id",
            "vendor_name",
            "booth_number",
            "description"
        ],
        searchOptions: {
            prefix: true,
            fuzzy: 0.2
        }
    });
    miniSearch.addAll(exploreVendors);
}

function performSearch(text) {
    const query = text.trim();
    foodSearchActive =
        exploreMode === "food" && query !== "";

    if (query === "") {
        searchResults = [];
    } else {
        searchResults = miniSearch.search(query, {
            prefix: true,
            fuzzy: 0.2
        });

        /*
         * In Food mode the same MiniSearch index is used, but
         * search results are restricted to food vendors.
         * MiniSearch results only contain storeFields, so use
         * vendor_id to recover the complete vendor objects.
         */
        if (exploreMode === "food") {
            const foodIds = new Set(
                foodVendors.map(v => v.vendor_id)
            );

            searchResults = searchResults.filter(result =>
                foodIds.has(result.vendor_id)
            );
        }
    }

    displayResults();
}

function displayResults() {
    const list = document.querySelector(".scroll-list");
    list.innerHTML = "";
    updateTabCounts();

    let vendorsToDisplay;

    if (exploreMode === "food") {

        if (foodSearchActive) {
            vendorsToDisplay = searchResults;
        }
        else if (currentTab === "trucks") {
            vendorsToDisplay = foodVendors.filter(v =>
                String(v.vendor_type || "").toLowerCase() === "truck"
            );
        }
        else if (currentTab === "foods") {
            vendorsToDisplay = foodVendors.filter(v =>
                String(v.vendor_type || "").toLowerCase() === "food"
            );
        }
        else if (currentTab === "drinks") {
            vendorsToDisplay = foodVendors.filter(v =>
                String(v.vendor_type || "").toLowerCase() === "drink"
            );
        }
        else if (currentTab === "favorites") {
            vendorsToDisplay = foodVendors.filter(v =>
                favoriteVendorIds.has(v.vendor_id)
            );
        }
        else {
            vendorsToDisplay = [];
        }

    } else {

        if (currentTab === "search") {
            vendorsToDisplay = searchResults;
        } else {
            vendorsToDisplay = exploreVendors.filter(v =>
                favoriteVendorIds.has(v.vendor_id)
            );
        }
    }

    vendorsToDisplay.forEach(vendor => {
        /*
         * Search results contain only MiniSearch storeFields.
         * Recover the complete vendor object for card/detail use.
         */
        const fullVendor =
            exploreVendors.find(v => v.vendor_id === vendor.vendor_id) || vendor;

        list.appendChild(createVendorCard(fullVendor));
    });
}
function setupVendorDetailPopup() {
    const overlay =
        document.getElementById("vendor-detail-overlay");
    const popup =
        document.getElementById("vendor-detail-popup");
    const closeButton =
        document.getElementById("vendor-detail-close");
    closeButton.addEventListener("click", closeVendorDetail);

    /*
     * Tapping the shaded area outside the popup
     * closes it.
     */
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeVendorDetail();
        }
    });

    /*
     * Prevent taps inside the popup from closing it.
     */
    popup.addEventListener("click", (event) => {
        event.stopPropagation();
    });
}


function showVendorDetail(vendor) {
    /*
     * MiniSearch only stores the fields listed in its
     * storeFields configuration. Therefore, search results
     * may not contain the featured_product fields.
     *
     * Retrieve the complete vendor object from the
     * original vendors array before displaying details.
     */
    const fullVendor =
        exploreVendors.find(v => v.vendor_id === vendor.vendor_id) || vendor;
    const content =
        document.getElementById("vendor-detail-content");
    content.innerHTML = "";

    const name = document.createElement("div");
    name.className = "vendor-detail-name";
    name.textContent = fullVendor.vendor_name || "";

    const booth = document.createElement("div");
    booth.className = "vendor-detail-booth";
    booth.textContent =
        fullVendor.booth_number
            ? `Booth: ${fullVendor.booth_number}`
            : "";

    const description = document.createElement("div");
    description.className = "vendor-detail-description";
    description.textContent = fullVendor.description || "";

    content.appendChild(name);

    if (fullVendor.booth_number) {
        content.appendChild(booth);
    }

    if (fullVendor.description) {
        content.appendChild(description);
    }

    /*
     * Only add the Featured Products section if at least
     * one of the three fields contains a value.
     */
    const products = [
        fullVendor.featured_product_1,
        fullVendor.featured_product_2,
        fullVendor.featured_product_3
    ].filter(product =>
        product !== null &&
        product !== undefined &&
        String(product).trim() !== ""
    );

    if (products.length > 0) {
        const productsSection =
            document.createElement("div");
        productsSection.className =
            "vendor-detail-products";
        const productsTitle =
            document.createElement("div");
        productsTitle.className =
            "vendor-detail-products-title";
        productsTitle.textContent =
            "Featured Products";
        productsSection.appendChild(productsTitle);
        products.forEach(product => {
            const productElement =
                document.createElement("div");
            productElement.className =
                "vendor-detail-product";
            productElement.textContent =
                "• " + String(product).trim();
            productsSection.appendChild(productElement);
        });
        content.appendChild(productsSection);
    }
    document
        .getElementById("vendor-detail-overlay")
        .classList.add("visible");
}


function closeVendorDetail() {
    document
        .getElementById("vendor-detail-overlay")
        .classList.remove("visible");
}

function createVendorCard(vendor) {
    const container = document.createElement("div");
    container.className = "info-box-container";
    container.innerHTML = `
    <div class="info-box">
        <img
            src="${favoriteVendorIds.has(vendor.vendor_id)
        ? "/static/images/star_filled.png"
        : "/static/images/star_outline.png"}"
            alt="Favorite"
            class="info-box-icon">

        <div class="info-box-content">
            <div class="info-box-header">
                <span class="vendor-name">${vendor.vendor_name}</span>
                <span class="booth-number">${vendor.booth_number}</span>
            </div>
            <div class="description-text">
                ${vendor.description || ""}
            </div>
        </div>
    </div>
    `;

    const star = container.querySelector(".info-box-icon");
    star.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(vendor.vendor_id);
    });

    /*
     * Tapping anywhere on the vendor card other than
     * the star opens the vendor detail popup.
     */
    const infoBox = container.querySelector(".info-box");
    infoBox.addEventListener("click", () => {
        showVendorDetail(vendor);
    });
    return container;
}

function switchTab(tab) {
    if (exploreMode === "food") {
        if (!["trucks", "foods", "drinks", "favorites"].includes(tab)) {
            return;
        }

        currentTab = tab;
        foodSearchActive = false;

        const input = document.getElementById("virtual-input");
        if (input) {
            input.value = "";
        }

        document.querySelectorAll(".tab-button").forEach(button => {
            const active = button.dataset.tab === tab;
            button.classList.toggle("active-tab", active);
            button.classList.toggle("inactive-tab", !active);
        });

        displayResults();
        return;
    }

    currentTab = tab;
    const buttons = document.querySelectorAll(".tab-button");
    buttons.forEach(button => {
        const active = button.dataset.tab === tab;
        button.classList.toggle("active-tab", active);
        button.classList.toggle("inactive-tab", !active);
    });
    displayResults();
}

function toggleFavorite(vendorId) {
    if (favoriteVendorIds.has(vendorId)) {
        favoriteVendorIds.delete(vendorId);
        removeFavoriteFromDB(vendorId);
    } else {
        favoriteVendorIds.add(vendorId);
        addFavoriteToDB(vendorId);
    }
    displayResults();
}

function isFavorite(vendorId) {
    return favoriteVendorIds.has(vendorId);
}

function updateTabCounts() {
    if (exploreMode === "food") {
        document.getElementById("trucks-tab").textContent =
            `Trucks (${foodVendors.filter(v => String(v.vendor_type || "").toLowerCase() === "truck").length})`;
        document.getElementById("foods-tab").textContent =
            `Foods (${foodVendors.filter(v => String(v.vendor_type || "").toLowerCase() === "food").length})`;
        document.getElementById("drinks-tab").textContent =
            `Drinks (${foodVendors.filter(v => String(v.vendor_type || "").toLowerCase() === "drink").length})`;
        document.getElementById("favorites-tab").textContent =
            `Favorites (${foodVendors.filter(v => favoriteVendorIds.has(v.vendor_id)).length})`;
        return;
    }

    document.getElementById("search-tab").textContent =
        `Search (${searchResults.length})`;
    document.getElementById("favorites-tab").textContent =
        `My Favorites (${favoriteVendorIds.size})`;
}
