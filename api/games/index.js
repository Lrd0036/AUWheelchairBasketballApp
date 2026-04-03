const { getContainer } = require("../cosmosClient");
const { v4: uuidv4 } = require("uuid");

module.exports = async function (context, req) {
  const container = getContainer("games");
  const method = req.method.toUpperCase();
  const id = req.params.id;

  // CORS headers
  context.res = {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  };

  if (method === "OPTIONS") {
    context.res.status = 204;
    return;
  }

  try {
    // GET /api/games or GET /api/games?sort=-date
    if (method === "GET" && !id) {
      const sort = req.query.sort || "";
      const { resources } = await container.items.readAll().fetchAll();

      let results = resources;

      // Handle filter queries e.g. ?game_id=xxx
      const filterKeys = Object.keys(req.query).filter(k => k !== "sort");
      if (filterKeys.length > 0) {
        results = results.filter(item =>
          filterKeys.every(k => String(item[k]) === String(req.query[k]))
        );
      }

      // Handle sorting e.g. sort=-date means descending by date
      if (sort) {
        const desc = sort.startsWith("-");
        const field = desc ? sort.slice(1) : sort;
        results.sort((a, b) => {
          if (a[field] < b[field]) return desc ? 1 : -1;
          if (a[field] > b[field]) return desc ? -1 : 1;
          return 0;
        });
      }

      context.res.status = 200;
      context.res.body = JSON.stringify(results);
      return;
    }

    // GET /api/games/:id
    if (method === "GET" && id) {
      const { resource } = await container.item(id, id).read();
      if (!resource) {
        context.res.status = 404;
        context.res.body = JSON.stringify({ error: "Game not found" });
        return;
      }
      context.res.status = 200;
      context.res.body = JSON.stringify(resource);
      return;
    }

    // POST /api/games
    if (method === "POST") {
      const body = req.body;
      const newItem = {
        id: uuidv4(),
        ...body,
        created_date: new Date().toISOString()
      };
      const { resource } = await container.items.create(newItem);
      context.res.status = 201;
      context.res.body = JSON.stringify(resource);
      return;
    }

    // PUT /api/games/:id
    if (method === "PUT" && id) {
      const { resource: existing } = await container.item(id, id).read();
      if (!existing) {
        context.res.status = 404;
        context.res.body = JSON.stringify({ error: "Game not found" });
        return;
      }
      const updated = { ...existing, ...req.body, id };
      const { resource } = await container.item(id, id).replace(updated);
      context.res.status = 200;
      context.res.body = JSON.stringify(resource);
      return;
    }

    // DELETE /api/games/:id
    if (method === "DELETE" && id) {
      await container.item(id, id).delete();
      context.res.status = 204;
      context.res.body = null;
      return;
    }

    context.res.status = 405;
    context.res.body = JSON.stringify({ error: "Method not allowed" });

  } catch (err) {
    context.log.error("Games function error:", err);
    context.res.status = 500;
    context.res.body = JSON.stringify({ error: err.message });
  }
};
