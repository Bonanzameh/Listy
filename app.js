const els = {
  themeToggle: document.querySelector("#theme-toggle"),
  showLists: document.querySelector("#show-lists"),
  showCards: document.querySelector("#show-cards"),
  sidebar: document.querySelector(".sidebar"),
  toggleLists: document.querySelector("#toggle-lists"),
  newListForm: document.querySelector("#new-list-form"),
  newListName: document.querySelector("#new-list-name"),
  listNav: document.querySelector("#list-nav"),
  emptyState: document.querySelector("#empty-state"),
  workspace: document.querySelector("#list-workspace"),
  listName: document.querySelector("#list-name"),
  deleteList: document.querySelector("#delete-list"),
  toggleItemDetails: document.querySelector("#toggle-item-details"),
  optionalFields: document.querySelector("#optional-fields"),
  itemForm: document.querySelector("#item-form"),
  itemTitle: document.querySelector("#item-title"),
  itemVolume: document.querySelector("#item-volume"),
  itemDue: document.querySelector("#item-due"),
  itemDescription: document.querySelector("#item-description"),
  submitItem: document.querySelector("#submit-item"),
  cancelEdit: document.querySelector("#cancel-edit"),
  statusMessage: document.querySelector("#status-message"),
  openItems: document.querySelector("#open-items"),
  doneItems: document.querySelector("#done-items"),
  listButtonTemplate: document.querySelector("#list-button-template"),
  itemTemplate: document.querySelector("#item-template"),
  cardsWorkspace: document.querySelector("#cards-workspace"),
  cardForm: document.querySelector("#card-form"),
  showCardForm: document.querySelector("#show-card-form"),
  cancelCardForm: document.querySelector("#cancel-card-form"),
  cardName: document.querySelector("#card-name"),
  cardNumber: document.querySelector("#card-number"),
  cardColor: document.querySelector("#card-color"),
  cardLogo: document.querySelector("#card-logo"),
  cardImage: document.querySelector("#card-image"),
  cardStatusMessage: document.querySelector("#card-status-message"),
  cardsGrid: document.querySelector("#cards-grid"),
  cardDisplay: document.querySelector("#card-display"),
  cardDisplayName: document.querySelector("#card-display-name"),
  barcodeStage: document.querySelector("#barcode-stage"),
  closeCardDisplay: document.querySelector("#close-card-display"),
  cardTemplate: document.querySelector("#card-template"),
};

const THEME_KEY = "listy:theme";
let state = { activeListId: null, lists: [], cards: [] };
let activeListId = null;
let editingItemId = null;
let currentView = "lists";

function getPreferredTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  els.themeToggle.textContent = theme === "dark" ? "Light" : "Dark";
  els.themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", theme === "dark" ? "#161616" : "#f7fafc");
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || getPreferredTheme();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

async function api(path, options = {}) {
  const requestOptions = Object.assign({}, options);
  requestOptions.headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  const response = await fetch(path, requestOptions);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return response.json();
}

async function loadState() {
  state = await api("/api/state");
  if (!activeListId || !state.lists.some((list) => list.id === activeListId)) {
    activeListId = state.activeListId || (state.lists[0] ? state.lists[0].id : null);
  }
  render();
}

function connectRealtime() {
  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    state = JSON.parse(event.data);
    if (!activeListId || !state.lists.some((list) => list.id === activeListId)) {
      activeListId = state.activeListId || (state.lists[0] ? state.lists[0].id : null);
    }
    render();
  };
  events.onerror = () => {
    events.close();
    setTimeout(connectRealtime, 1500);
  };
}

function getActiveList() {
  return state.lists.find((list) => list.id === activeListId) || state.lists[0] || null;
}

function sortItems(items) {
  return items.slice().sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

function render() {
  renderView();
  renderListNav();
  renderWorkspace();
  renderCards();
}

function renderView() {
  const isCards = currentView === "cards";
  els.showLists.classList.toggle("active", !isCards);
  els.showCards.classList.toggle("active", isCards);
  els.newListForm.hidden = isCards;
  els.listNav.hidden = isCards;
  els.emptyState.hidden = isCards || Boolean(getActiveList());
  els.workspace.hidden = isCards || !getActiveList();
  els.cardsWorkspace.hidden = !isCards;
}

function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function setStatus(message, isError) {
  els.statusMessage.hidden = !message;
  els.statusMessage.textContent = message || "";
  els.statusMessage.classList.toggle("is-error", Boolean(isError));
}

function setCardStatus(message, isError) {
  els.cardStatusMessage.hidden = !message;
  els.cardStatusMessage.textContent = message || "";
  els.cardStatusMessage.classList.toggle("is-error", Boolean(isError));
}

function setOptionalFieldsVisible(isVisible) {
  els.optionalFields.hidden = !isVisible;
  els.toggleItemDetails.setAttribute("aria-expanded", String(isVisible));
  setStatus("", false);
}

function getItemById(itemId) {
  const list = getActiveList();
  if (!list) {
    return null;
  }
  return list.items.find((item) => item.id === itemId) || null;
}

function setItemFormMode(item) {
  editingItemId = item ? item.id : null;
  els.itemTitle.value = item ? item.title : "";
  els.itemVolume.value = item && item.volume ? item.volume : "";
  els.itemDue.value = item && item.dueDate ? item.dueDate : "";
  els.itemDescription.value = item && item.description ? item.description : "";
  els.submitItem.textContent = item ? "Save" : "+";
  els.submitItem.setAttribute("aria-label", item ? "Save item" : "Add item");
  els.cancelEdit.hidden = !item;
  setOptionalFieldsVisible(Boolean(item && (item.volume || item.dueDate || item.description)));
  setStatus(item ? "Editing item" : "", false);
  els.itemTitle.focus();
}

function renderListNav() {
  clearElement(els.listNav);

  if (!state.lists.length) {
    const empty = document.createElement("p");
    empty.className = "hidden-message";
    empty.textContent = "No lists yet.";
    els.listNav.append(empty);
    return;
  }

  state.lists
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .forEach((list) => {
      const button = els.listButtonTemplate.content.firstElementChild.cloneNode(true);
      const openCount = list.items.filter((item) => !item.done).length;
      button.classList.toggle("active", list.id === activeListId);
      button.querySelector(".list-button-name").textContent = list.name || "Untitled list";
      button.querySelector(".list-button-count").textContent = `${openCount}/${list.items.length}`;
      button.addEventListener("click", () => {
        activeListId = list.id;
        setItemFormMode(null);
        els.sidebar.classList.add("collapsed");
        render();
      });
      els.listNav.append(button);
    });
}

function renderWorkspace() {
  const list = getActiveList();
  activeListId = list ? list.id : null;

  els.emptyState.hidden = currentView === "cards" || Boolean(list);
  els.workspace.hidden = currentView === "cards" || !list;

  if (!list) {
    return;
  }

  els.listName.value = list.name;
  const openItems = sortItems(list.items.filter((item) => !item.done));
  const doneItems = sortItems(list.items.filter((item) => item.done));

  renderItems(els.openItems, openItems);
  renderItems(els.doneItems, doneItems);
}

function renderItems(container, items) {
  clearElement(container);

  if (!items.length && container === els.openItems) {
    const empty = document.createElement("p");
    empty.className = "hidden-message";
    empty.textContent = "No items yet.";
    container.append(empty);
    return;
  }

  items.forEach((item) => {
    const card = els.itemTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = card.querySelector(".item-check");
    const title = card.querySelector(".item-title");
    const subtitle = card.querySelector(".item-subtitle");
    const swipeHint = card.querySelector(".swipe-hint");
    const itemActions = card.querySelector(".item-actions");
    const editButton = card.querySelector(".item-edit");
    const deleteButton = card.querySelector(".item-delete");

    checkbox.checked = item.done;
    title.textContent = item.title;
    subtitle.textContent = getItemSubtitle(item);
    card.classList.toggle("is-done", item.done);

    checkbox.addEventListener("change", () => updateItem(item.id, { done: checkbox.checked }));
    card.querySelector(".item-copy").addEventListener("click", () => setItemFormMode(item));
    editButton.addEventListener("click", () => setItemFormMode(item));
    deleteButton.addEventListener("click", () => deleteItem(item.id));
    attachSwipeActions(card, item, itemActions, swipeHint);

    container.append(card);
  });
}

function renderCards() {
  clearElement(els.cardsGrid);
  const cards = (state.cards || []).slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const addTile = document.createElement("button");
  addTile.className = "customer-card add-card-tile";
  addTile.type = "button";
  addTile.setAttribute("aria-label", "Add card");
  addTile.textContent = "+";
  addTile.addEventListener("click", openCardForm);
  els.cardsGrid.append(addTile);

  if (!cards.length) {
    const empty = document.createElement("p");
    empty.className = "hidden-message";
    empty.textContent = "No cards yet.";
    els.cardsGrid.append(empty);
    return;
  }

  cards.forEach((card) => {
    const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
    const main = node.querySelector(".customer-card-main");
    const logo = node.querySelector(".customer-card-logo");
    main.style.background = card.color || "#087ca7";
    if (card.logoData) {
      const logoImage = document.createElement("img");
      logoImage.src = card.logoData;
      logoImage.alt = "";
      logo.append(logoImage);
    } else {
      logo.textContent = getCardInitials(card.name);
    }
    node.querySelector(".customer-card-name").textContent = card.name;
    node.querySelector(".customer-card-number").textContent = card.number || (card.imageData ? "Image barcode" : "No barcode");
    main.addEventListener("click", () => showCard(card));
    node.querySelector(".card-delete").addEventListener("click", () => deleteCard(card.id));
    els.cardsGrid.append(node);
  });
}

function openCardForm() {
  els.cardForm.hidden = false;
  els.showCardForm.hidden = true;
  setCardStatus("", false);
  els.cardName.focus();
}

function closeCardForm() {
  els.cardForm.reset();
  els.cardColor.value = "#087ca7";
  els.cardForm.hidden = true;
  els.showCardForm.hidden = false;
  setCardStatus("", false);
}

function getCardInitials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return "C";
  }
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join("");
}

function showCard(card) {
  els.cardDisplay.hidden = false;
  els.cardDisplayName.textContent = card.name;
  clearElement(els.barcodeStage);

  if (card.imageData) {
    const image = document.createElement("img");
    image.className = "barcode-image";
    image.src = card.imageData;
    image.alt = `${card.name} barcode`;
    els.barcodeStage.append(image);
  }

  if (card.number) {
    const barcode = createCode128Svg(card.number);
    els.barcodeStage.append(barcode);
  }

  if (!card.imageData && !card.number) {
    const empty = document.createElement("p");
    empty.className = "hidden-message";
    empty.textContent = "This card has no barcode yet.";
    els.barcodeStage.append(empty);
  }
}

function createCode128Svg(value) {
  const patterns = [
    "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
    "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
    "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
    "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
    "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
    "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
    "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
    "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
    "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
    "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
    "114131","311141","411131","211412","211214","211232","2331112"
  ];
  const chars = String(value).replace(/[^\x20-\x7e]/g, "");
  const codes = [104];
  for (let index = 0; index < chars.length; index += 1) {
    codes.push(chars.charCodeAt(index) - 32);
  }
  let checksum = 104;
  for (let index = 1; index < codes.length; index += 1) {
    checksum += codes[index] * index;
  }
  codes.push(checksum % 103, 106);

  const quiet = 12;
  const barHeight = 82;
  const moduleWidth = 2;
  let x = quiet;
  const rects = [];
  codes.forEach((code) => {
    const pattern = patterns[code];
    for (let index = 0; index < pattern.length; index += 1) {
      const width = Number(pattern[index]) * moduleWidth;
      if (index % 2 === 0) {
        rects.push(`<rect x="${x}" y="10" width="${width}" height="${barHeight}"></rect>`);
      }
      x += width;
    }
  });
  const width = x + quiet;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "generated-barcode");
  svg.setAttribute("viewBox", `0 0 ${width} 124`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Barcode ${chars}`);
  svg.innerHTML = `<rect width="100%" height="100%" fill="#fff"></rect><g fill="#000">${rects.join("")}</g><text x="${width / 2}" y="113" text-anchor="middle" font-family="monospace" font-size="14" fill="#000">${escapeHtml(chars)}</text>`;
  return svg;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getItemSubtitle(item) {
  const details = [];
  if (item.volume) {
    details.push(item.volume);
  }
  if (item.dueDate) {
    details.push(`Due ${formatDate(item.dueDate)}`);
  }
  if (item.description) {
    details.push(item.description);
  }

  return details.join(" - ");
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function attachSwipeActions(card, item, itemActions, swipeHint) {
  let startX = 0;
  let startY = 0;
  let active = false;

  function clearSwipeCue() {
    card.classList.remove("swipe-right", "swipe-left");
    swipeHint.textContent = "";
  }

  card.addEventListener("pointerdown", (event) => {
    if (event.target.closest && event.target.closest("button, input, label")) {
      return;
    }

    active = true;
    startX = event.clientX;
    startY = event.clientY;
    if (card.setPointerCapture) {
      card.setPointerCapture(event.pointerId);
    }
  });

  card.addEventListener("pointermove", (event) => {
    if (!active) {
      return;
    }

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      card.style.transform = `translateX(${Math.max(-72, Math.min(72, deltaX))}px)`;
      card.classList.toggle("swipe-right", deltaX > 16);
      card.classList.toggle("swipe-left", deltaX < -16);
      if (deltaX > 16) {
        swipeHint.textContent = item.done ? "Open" : "Done";
      } else if (deltaX < -16) {
        swipeHint.textContent = "Edit / Delete";
      } else {
        swipeHint.textContent = "";
      }
    }
  });

  card.addEventListener("pointerup", (event) => {
    if (!active) {
      return;
    }

    active = false;
    const deltaX = event.clientX - startX;
    card.style.transform = "";
    clearSwipeCue();
    if (deltaX >= 58) {
      itemActions.hidden = true;
      updateItem(item.id, { done: !item.done });
    } else if (deltaX <= -44) {
      itemActions.hidden = !itemActions.hidden;
    }
  });

  card.addEventListener("pointercancel", () => {
    active = false;
    card.style.transform = "";
    clearSwipeCue();
  });
}

async function updateActiveList(patch) {
  const list = getActiveList();
  if (!list) {
    return;
  }

  state = await api(`/api/lists/${list.id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  render();
}

async function updateItem(itemId, patch) {
  const list = getActiveList();
  if (!list) {
    return;
  }

  state = await api(`/api/lists/${list.id}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  render();
}

async function deleteItem(itemId) {
  const list = getActiveList();
  if (!list) {
    return;
  }
  const item = getItemById(itemId);
  const confirmed = confirm(`Delete "${item ? item.title : "this item"}"?`);
  if (!confirmed) {
    return;
  }

  state = await api(`/api/lists/${list.id}/items/${itemId}`, {
    method: "DELETE",
  });
  if (editingItemId === itemId) {
    setItemFormMode(null);
  }
  render();
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please upload an image file"));
      return;
    }
    if (file.size > 3_500_000) {
      reject(new Error("Image is too large"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

async function deleteCard(cardId) {
  const card = (state.cards || []).find((candidate) => candidate.id === cardId);
  const confirmed = confirm(`Delete "${card ? card.name : "this card"}"?`);
  if (!confirmed) {
    return;
  }

  try {
    state = await api(`/api/cards/${cardId}`, { method: "DELETE" });
    els.cardDisplay.hidden = true;
    render();
  } catch (error) {
    setCardStatus(error.message, true);
  }
}

els.newListForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.newListName.value.trim();
  if (!name) {
    return;
  }

  try {
    state = await api("/api/lists", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    activeListId = state.activeListId;
    els.newListForm.reset();
    render();
  } catch (error) {
    setStatus(error.message, true);
  }
});

els.showLists.addEventListener("click", () => {
  currentView = "lists";
  render();
});

els.showCards.addEventListener("click", () => {
  currentView = "cards";
  els.sidebar.classList.add("collapsed");
  render();
});

els.listName.addEventListener("change", () => {
  updateActiveList({ name: els.listName.value.trim() || "Untitled list" });
});

els.deleteList.addEventListener("click", async () => {
  const list = getActiveList();
  if (!list) {
    return;
  }

  const confirmed = confirm(`Delete "${list.name}" and all of its items?`);
  if (!confirmed) {
    return;
  }

  try {
    state = await api(`/api/lists/${list.id}`, { method: "DELETE" });
    activeListId = state.activeListId || (state.lists[0] ? state.lists[0].id : null);
    render();
  } catch (error) {
    setStatus(error.message, true);
  }
});

els.itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const list = getActiveList();
  const title = els.itemTitle.value.trim();
  if (!list || !title) {
    return;
  }

  try {
    const payload = {
      title,
      description: els.itemDescription.value.trim(),
      volume: els.itemVolume.value.trim(),
      dueDate: els.itemDue.value,
    };

    if (editingItemId) {
      state = await api(`/api/lists/${list.id}/items/${editingItemId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      state = await api(`/api/lists/${list.id}/items`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    els.itemForm.reset();
    editingItemId = null;
    els.submitItem.textContent = "+";
    els.submitItem.setAttribute("aria-label", "Add item");
    els.cancelEdit.hidden = true;
    setOptionalFieldsVisible(false);
    els.itemTitle.focus();
    render();
  } catch (error) {
    setStatus(error.message, true);
  }
});

els.cardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.cardName.value.trim();
  const number = els.cardNumber.value.trim();

  if (!name) {
    return;
  }

  try {
    const imageData = await readImageFile(els.cardImage.files[0]);
    const logoData = await readImageFile(els.cardLogo.files[0]);
    if (!number && !imageData) {
      throw new Error("Add a barcode number or upload an image");
    }
    state = await api("/api/cards", {
      method: "POST",
      body: JSON.stringify({ name, number, imageData, logoData, color: els.cardColor.value }),
    });
    closeCardForm();
    setCardStatus("", false);
    render();
  } catch (error) {
    setCardStatus(error.message, true);
  }
});

els.showCardForm.addEventListener("click", openCardForm);

els.cancelCardForm.addEventListener("click", closeCardForm);

els.closeCardDisplay.addEventListener("click", () => {
  els.cardDisplay.hidden = true;
});

els.toggleItemDetails.addEventListener("click", () => {
  setOptionalFieldsVisible(els.optionalFields.hidden);
});

els.cancelEdit.addEventListener("click", () => {
  els.itemForm.reset();
  setItemFormMode(null);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.optionalFields.hidden) {
    setOptionalFieldsVisible(false);
  }
});

els.toggleLists.addEventListener("click", () => {
  els.sidebar.classList.toggle("collapsed");
});

els.themeToggle.addEventListener("click", toggleTheme);

els.sidebar.classList.toggle("collapsed", window.matchMedia("(max-width: 760px)").matches);

applyTheme(getPreferredTheme());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}

loadState().then(connectRealtime).catch((error) => {
  els.emptyState.hidden = false;
  els.workspace.hidden = true;
  els.emptyState.querySelector("p").textContent = error.message;
});
