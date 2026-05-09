# Listy

Listy is a responsive list web app for tasks, shopping, and errands. It supports creating, renaming, and deleting lists; adding items with a title, optional description, optional volume, and optional due date; editing items inline; deleting items; and checking items off.

Checked items are shown in the Done section at the bottom. Open and done items are each sorted alphabetically.

## Run with Docker Compose

```bash
docker compose up --build
```

Then open:

```text
http://localhost:8080
```

## Run without Docker

Because this is a static app, you can also serve the folder locally:

```bash
python3 -m http.server 8080
```

## Data Storage

Data is stored in the browser using `localStorage`. This keeps the app simple to host from GitHub or a small container, but data is local to each browser/device.
