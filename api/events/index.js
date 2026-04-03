const { getContainer } = require("../cosmosClient");
const { v4: uuidv4 } = require("uuid");

module.exports = async function (context, req) {
  const container = getContainer("events");
  const method = req.method.toUpperCase();
  const id = req.params.id;

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
    // GET /api/events
    if (method === "GET" && !id) {
      const sort = req.query.sort || "";
      const { resources } = await container.items.readAll().fetchAll();

      let results = resources;

      // Handle filter queries e.g. ?game_id=xxx or ?player_id=xxx
      const filterKeys = Object.keys(req.query).filter(k => k !== "sort" && k !== "limit");
      if (filterKeys.length > 0) {
        results = results.filter(item =>
          filterKeys.every(k => String(item[k]) === String(req.query[k]))
        );
      }

      if (sort) {
        const desc = sort.startsWith("-");
        const field = desc ? sort.slice(1) : sort;
        results.sort((a, b) => {
          if (a[field] < b[field]) return desc ? 1 : -1;
          if (a[field] > b[field]) return desc ? -1 : 1;
          return 0;
        });
      }

      // Handle limit e.g. ?limit=5000
      if (req.query.limit) {
        results = results.slice(0, parseInt(req.query.limit));
      }

      context.res.status = 200;
      context.res.body = JSON.stringify(results);
      return;
    }

    // GET /api/events/:id
    if (method === "GET" && id) {
      const { resource } = await container.item(id, req.query.game_id || id).read();
      if (!resource) {
        context.res.status = 404;
        context.res.body = JSON.stringify({ error: "Event not found" });
        return;
      }
      context.res.status = 200;
      context.res.body = JSON.stringify(resource);
      return;
    }

    // POST /api/events
    if (method === "POST") {
      const body = req.body;
      const newItem = {
        id: uuidv4(),
        ...body,
        timestamp: body.timestamp || new Date().toISOString(),
        created_date: new Date().toISOString()
      };
      const { resource } = await container.items.create(newItem);
      context.res.status = 201;
      context.res.body = JSON.stringify(resource);
      return;
    }

    // PUT /api/events/:id
    if (method === "PUT" && id) {
      const gameId = req.body.game_id;
      const { resource: existing } = await container.item(id, gameId).read();
      if (!existing) {
        context.res.status = 404;
        context.res.body = JSON.stringify({ error: "Event not found" });
        return;
      }
      const updated = { ...existing, ...req.body, id };
      const { resource } = await container.item(id, gameId).replace(updated);
      context.res.status = 200;
      context.res.body = JSON.stringify(resource);
      return;
    }

    // DELETE /api/events/:id
    if (method === "DELETE" && id) {
      // Need game_id as partition key - fetch first to get it
      const { resources } = await container.items
        .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: id }] })
        .fetchAll();
      if (resources.length === 0) {
        context.res.status = 404;
        context.res.body = JSON.stringify({ error: "Event not found" });
        return;
      }
      const event = resources[0];
      await container.item(id, event.game_id).delete();
      context.res.status = 204;
      context.res.body = null;
      return;
    }

    context.res.status = 405;
    context.res.body = JSON.stringify({ error: "Method not allowed" });

  } catch (err) {
    context.log.error("Events function error:", err);
    context.res.status = 500;
    context.res.body = JSON.stringify({ error: err.message });
  }
};
