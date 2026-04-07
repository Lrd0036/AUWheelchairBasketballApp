const { app } = require("@azure/functions");
const { getContainer } = require("./db");
const { v4: uuidv4 } = require("uuid");

// ─── CORS helper ───────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function ok(body) {
  return { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
function created(body) {
  return { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
function noContent() {
  return { status: 204, headers: corsHeaders };
}
function notFound(msg) {
  return { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ error: msg }) };
}
function serverError(err) {
  return { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message }) };
}

// ─── Generic list helper ───────────────────────────────────────────────────
async function listItems(container, query, sort) {
  const { resources } = await container.items.readAll().fetchAll();
  let results = resources;

  if (query && Object.keys(query).length > 0) {
    results = results.filter(item =>
      Object.entries(query).every(([k, v]) => String(item[k]) === String(v))
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

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// GAMES
// ═══════════════════════════════════════════════════════════════════════════
app.http("games", {
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "games/{id?}",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const container = getContainer("games");
    const id = request.params.id;

    try {
      // GET all
      if (request.method === "GET" && !id) {
        const params = Object.fromEntries(request.query);
        const sort = params.sort || "";
        delete params.sort;
        const results = await listItems(container, params, sort);
        return ok(results);
      }

      // GET one
      if (request.method === "GET" && id) {
        const { resource } = await container.item(id, id).read();
        if (!resource) return notFound("Game not found");
        return ok(resource);
      }

      // POST
      if (request.method === "POST") {
        const body = await request.json();
        const newItem = { id: uuidv4(), ...body, created_date: new Date().toISOString() };
        const { resource } = await container.items.create(newItem);
        return created(resource);
      }

      // PUT
      if (request.method === "PUT" && id) {
        const body = await request.json();
        const { resource: existing } = await container.item(id, id).read();
        if (!existing) return notFound("Game not found");
        const updated = { ...existing, ...body, id };
        const { resource } = await container.item(id, id).replace(updated);
        return ok(resource);
      }

      // DELETE
      if (request.method === "DELETE" && id) {
        await container.item(id, id).delete();
        return noContent();
      }

    } catch (err) {
      context.error("Games error:", err);
      return serverError(err);
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// PLAYERS
// ═══════════════════════════════════════════════════════════════════════════
app.http("players", {
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "players/{id?}",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const container = getContainer("players");
    const id = request.params.id;

    try {
      // GET all
      if (request.method === "GET" && !id) {
        const params = Object.fromEntries(request.query);
        const sort = params.sort || "";
        delete params.sort;
        const results = await listItems(container, params, sort);
        return ok(results);
      }

      // GET one
      if (request.method === "GET" && id) {
        const { resource } = await container.item(id, id).read();
        if (!resource) return notFound("Player not found");
        return ok(resource);
      }

      // POST
      if (request.method === "POST") {
        const body = await request.json();
        const newItem = { id: uuidv4(), ...body, created_date: new Date().toISOString() };
        const { resource } = await container.items.create(newItem);
        return created(resource);
      }

      // PUT
      if (request.method === "PUT" && id) {
        const body = await request.json();
        const { resource: existing } = await container.item(id, id).read();
        if (!existing) return notFound("Player not found");
        const updated = { ...existing, ...body, id };
        const { resource } = await container.item(id, id).replace(updated);
        return ok(resource);
      }

      // DELETE
      if (request.method === "DELETE" && id) {
        await container.item(id, id).delete();
        return noContent();
      }

    } catch (err) {
      context.error("Players error:", err);
      return serverError(err);
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════
app.http("events", {
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "events/{id?}",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return noContent();

    const container = getContainer("events");
    const id = request.params.id;

    try {
      // GET all
      if (request.method === "GET" && !id) {
        const params = Object.fromEntries(request.query);
        const sort = params.sort || "";
        const limit = params.limit ? parseInt(params.limit) : null;
        delete params.sort;
        delete params.limit;
        let results = await listItems(container, params, sort);
        if (limit) results = results.slice(0, limit);
        return ok(results);
      }

      // GET one
      if (request.method === "GET" && id) {
        const { resources } = await container.items
          .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: id }] })
          .fetchAll();
        if (!resources.length) return notFound("Event not found");
        return ok(resources[0]);
      }

      // POST
      if (request.method === "POST") {
        const body = await request.json();
        const newItem = {
          id: uuidv4(),
          ...body,
          timestamp: body.timestamp || new Date().toISOString(),
          created_date: new Date().toISOString(),
        };
        const { resource } = await container.items.create(newItem);
        return created(resource);
      }

      // PUT
      if (request.method === "PUT" && id) {
        const body = await request.json();
        const { resources } = await container.items
          .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: id }] })
          .fetchAll();
        if (!resources.length) return notFound("Event not found");
        const existing = resources[0];
        const updated = { ...existing, ...body, id };
        const { resource } = await container.item(id, existing.game_id).replace(updated);
        return ok(resource);
      }

      // DELETE
      if (request.method === "DELETE" && id) {
        const { resources } = await container.items
          .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: id }] })
          .fetchAll();
        if (!resources.length) return notFound("Event not found");
        await container.item(id, resources[0].game_id).delete();
        return noContent();
      }

    } catch (err) {
      context.error("Events error:", err);
      return serverError(err);
    }
  },
});
