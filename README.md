# Listy

Listy is a responsive list web app for tasks, shopping, and errands. It supports creating, renaming, and deleting lists; adding items with a title, optional description, optional volume, and optional due date; deleting items; and checking items off.

Checked items are shown in the Done section at the bottom. Open and done items are each sorted alphabetically. Data is stored centrally in the container data volume, and connected browsers receive realtime updates.

## Run with Docker Compose

```bash
docker compose up --build
```

Then open:

```text
http://localhost:8080
```

## Run without Docker

You can also run it locally with Node.js:

```bash
node server.js
```

## Data Storage

Data is stored in `/app/data/listy.json` inside the container. The included `docker-compose.yml` mounts that path to the `listy_data` Docker volume so data survives container rebuilds.
