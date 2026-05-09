const els = {
  sidebar: document.querySelector(".sidebar"),
  toggleLists: document.querySelector("#toggle-lists"),
  newListForm: document.querySelector("#new-list-form"),
  newListName: document.querySelector("#new-list-name"),
  listNav: document.querySelector("#list-nav"),
  emptyState: document.querySelector("#empty-state"),
  workspace: document.querySelector("#list-workspace"),
  listName: document.querySelector("#list-name"),
  deleteList: document.querySelector("#delete-list"),
  showItemForm: document.querySelector("#show-item-form"),
  closeItemForm: document.querySelector("#close-item-form"),
  itemForm: document.querySelector("#item-form"),
  itemTitle: document.querySelector("#item-title"),
  itemVolume: document.querySelector("#item-volume"),
  itemDue: document.querySelector("#item-due"),
  itemDescription: document.querySelector("#item-description"),
  statusMessage: document.querySelector("#status-message"),
  summaryRow: document.querySelector("#summary-row"),
  openItems: document.querySelector("#open-items"),
  doneItems: document.querySelector("#done-items"),
  listButtonTemplate: document.querySelector("#list-button-template"),
  itemTemplate: document.querySelector("#item-template"),
};

let state = { activeListId: null, lists: [] };
let activeListId = null;

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
  renderListNav();
  renderWorkspace();
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

function openItemForm() {
  els.itemForm.reset();
  els.itemForm.hidden = false;
  setStatus("", false);
  setTimeout(() => els.itemTitle.focus(), 0);
}

function closeItemForm() {
  els.itemForm.hidden = true;
  setStatus("", false);
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
        els.sidebar.classList.add("collapsed");
        render();
      });
      els.listNav.append(button);
    });
}

function renderWorkspace() {
  const list = getActiveList();
  activeListId = list ? list.id : null;

  els.emptyState.hidden = Boolean(list);
  els.workspace.hidden = !list;

  if (!list) {
    return;
  }

  els.listName.value = list.name;
  const openItems = sortItems(list.items.filter((item) => !item.done));
  const doneItems = sortItems(list.items.filter((item) => item.done));

  clearElement(els.summaryRow);
  els.summaryRow.appendChild(createPill(`${openItems.length} open`));
  els.summaryRow.appendChild(createPill(`${doneItems.length} done`));
  els.summaryRow.appendChild(createPill(`${list.items.length} total`));

  renderItems(els.openItems, openItems);
  renderItems(els.doneItems, doneItems);
}

function createPill(text) {
  const pill = document.createElement("span");
  pill.className = "summary-pill";
  pill.textContent = text;
  return pill;
}

function renderItems(container, items) {
  clearElement(container);

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "hidden-message";
    empty.textContent = "Nothing here.";
    container.append(empty);
    return;
  }

  items.forEach((item) => {
    const card = els.itemTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = card.querySelector(".item-check");
    const title = card.querySelector(".item-title");
    const subtitle = card.querySelector(".item-subtitle");
    const deleteButton = card.querySelector(".item-delete");

    checkbox.checked = item.done;
    title.textContent = item.title;
    subtitle.textContent = getItemSubtitle(item);
    card.classList.toggle("is-done", item.done);

    checkbox.addEventListener("change", () => updateItem(item.id, { done: checkbox.checked }));
    deleteButton.addEventListener("click", () => deleteItem(item.id));
    attachSwipeToggle(card, item);

    container.append(card);
  });
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

function attachSwipeToggle(card, item) {
  let startX = 0;
  let startY = 0;
  let active = false;

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
      card.style.transform = `translateX(${Math.max(-90, Math.min(90, deltaX))}px)`;
    }
  });

  card.addEventListener("pointerup", (event) => {
    if (!active) {
      return;
    }

    active = false;
    const deltaX = event.clientX - startX;
    card.style.transform = "";
    if (Math.abs(deltaX) >= 64) {
      updateItem(item.id, { done: !item.done });
    }
  });

  card.addEventListener("pointercancel", () => {
    active = false;
    card.style.transform = "";
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

  state = await api(`/api/lists/${list.id}/items/${itemId}`, {
    method: "DELETE",
  });
  render();
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
    state = await api(`/api/lists/${list.id}/items`, {
      method: "POST",
      body: JSON.stringify({
        title,
        description: els.itemDescription.value.trim(),
        volume: els.itemVolume.value.trim(),
        dueDate: els.itemDue.value,
      }),
    });

    els.itemForm.reset();
    closeItemForm();
    render();
  } catch (error) {
    setStatus(error.message, true);
  }
});

els.showItemForm.addEventListener("click", () => {
  openItemForm();
});

els.closeItemForm.addEventListener("click", () => {
  closeItemForm();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.itemForm.hidden) {
    closeItemForm();
  }
});

els.toggleLists.addEventListener("click", () => {
  els.sidebar.classList.toggle("collapsed");
});

els.sidebar.classList.toggle("collapsed", window.matchMedia("(max-width: 760px)").matches);

loadState().then(connectRealtime).catch((error) => {
  els.emptyState.hidden = false;
  els.workspace.hidden = true;
  els.emptyState.querySelector("p").textContent = error.message;
});
