const STORAGE_KEY = "listy:v1";

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
  itemDialog: document.querySelector("#item-dialog"),
  itemForm: document.querySelector("#item-form"),
  itemTitle: document.querySelector("#item-title"),
  itemVolume: document.querySelector("#item-volume"),
  itemDue: document.querySelector("#item-due"),
  itemDescription: document.querySelector("#item-description"),
  summaryRow: document.querySelector("#summary-row"),
  openItems: document.querySelector("#open-items"),
  doneItems: document.querySelector("#done-items"),
  listButtonTemplate: document.querySelector("#list-button-template"),
  itemTemplate: document.querySelector("#item-template"),
};

let state = loadState();

function createId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultState() {
  const listId = createId();
  return {
    activeListId: listId,
    lists: [
      {
        id: listId,
        name: "Shopping",
        createdAt: new Date().toISOString(),
        items: [
          {
            id: createId(),
            title: "Eggs",
            description: "",
            volume: "6",
            dueDate: "",
            done: false,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ],
  };
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.lists)) {
      return stored;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return defaultState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getActiveList() {
  return state.lists.find((list) => list.id === state.activeListId) || state.lists[0] || null;
}

function sortItems(items) {
  return [...items].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

function render() {
  renderListNav();
  renderWorkspace();
  saveState();
}

function renderListNav() {
  els.listNav.replaceChildren();

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
      button.classList.toggle("active", list.id === state.activeListId);
      button.querySelector(".list-button-name").textContent = list.name || "Untitled list";
      button.querySelector(".list-button-count").textContent = `${openCount}/${list.items.length}`;
      button.addEventListener("click", () => {
        state.activeListId = list.id;
        els.sidebar.classList.add("collapsed");
        render();
      });
      els.listNav.append(button);
    });
}

function renderWorkspace() {
  const list = getActiveList();
  state.activeListId = list?.id || null;

  els.emptyState.hidden = Boolean(list);
  els.workspace.hidden = !list;

  if (!list) {
    return;
  }

  els.listName.value = list.name;
  const openItems = sortItems(list.items.filter((item) => !item.done));
  const doneItems = sortItems(list.items.filter((item) => item.done));

  els.summaryRow.replaceChildren(
    createPill(`${openItems.length} open`),
    createPill(`${doneItems.length} done`),
    createPill(`${list.items.length} total`),
  );

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
  container.replaceChildren();

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
    if (event.target.closest("button, input, label")) {
      return;
    }

    active = true;
    startX = event.clientX;
    startY = event.clientY;
    card.setPointerCapture(event.pointerId);
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

function updateActiveList(patch) {
  const list = getActiveList();
  if (!list) {
    return;
  }

  Object.assign(list, patch);
  render();
}

function updateItem(itemId, patch) {
  const list = getActiveList();
  if (!list) {
    return;
  }

  const item = list.items.find((candidate) => candidate.id === itemId);
  if (!item) {
    return;
  }

  Object.assign(item, patch);
  render();
}

function deleteItem(itemId) {
  const list = getActiveList();
  if (!list) {
    return;
  }

  list.items = list.items.filter((item) => item.id !== itemId);
  render();
}

els.newListForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.newListName.value.trim();
  if (!name) {
    return;
  }

  const list = {
    id: createId(),
    name,
    createdAt: new Date().toISOString(),
    items: [],
  };

  state.lists.push(list);
  state.activeListId = list.id;
  els.newListForm.reset();
  render();
});

els.listName.addEventListener("change", () => {
  updateActiveList({ name: els.listName.value.trim() || "Untitled list" });
});

els.deleteList.addEventListener("click", () => {
  const list = getActiveList();
  if (!list) {
    return;
  }

  const confirmed = confirm(`Delete "${list.name}" and all of its items?`);
  if (!confirmed) {
    return;
  }

  state.lists = state.lists.filter((candidate) => candidate.id !== list.id);
  state.activeListId = state.lists[0]?.id || null;
  render();
});

els.itemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const list = getActiveList();
  const title = els.itemTitle.value.trim();
  if (!list || !title) {
    return;
  }

  list.items.push({
    id: createId(),
    title,
    description: els.itemDescription.value.trim(),
    volume: els.itemVolume.value.trim(),
    dueDate: els.itemDue.value,
    done: false,
    createdAt: new Date().toISOString(),
  });

  els.itemForm.reset();
  els.itemDialog.close();
  render();
});

els.showItemForm.addEventListener("click", () => {
  els.itemForm.reset();
  els.itemDialog.showModal();
  els.itemTitle.focus();
});

els.closeItemForm.addEventListener("click", () => {
  els.itemDialog.close();
});

els.itemDialog.addEventListener("click", (event) => {
  if (event.target === els.itemDialog) {
    els.itemDialog.close();
  }
});

els.toggleLists.addEventListener("click", () => {
  els.sidebar.classList.toggle("collapsed");
});

els.sidebar.classList.toggle("collapsed", window.matchMedia("(max-width: 760px)").matches);

render();
