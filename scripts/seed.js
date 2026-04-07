#!/usr/bin/env node
/**
 * scripts/seed.js
 *
 * Creates realistic test data against your local Azure Functions API.
 * Run with:  node scripts/seed.js
 *
 * Prerequisites:
 *   - func start --script-root api --port 7071   (running in another terminal)
 */

const BASE = "http://localhost:7071/api";

// ─── helpers ────────────────────────────────────────────────────────────────
async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function put(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

function isoDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function ts(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

// ─── roster ─────────────────────────────────────────────────────────────────
const PLAYERS = [
  { name: "Jordan Mercer",   number: "4",  classification: 3.5, status: "active",  position: "Forward" },
  { name: "Sam Rivera",      number: "10", classification: 2.0, status: "active",  position: "Guard" },
  { name: "Taylor Brooks",   number: "22", classification: 1.0, status: "active",  position: "Guard" },
  { name: "Alex Nguyen",     number: "7",  classification: 3.0, status: "active",  position: "Center" },
  { name: "Morgan Lee",      number: "15", classification: 2.5, status: "active",  position: "Forward" },
  { name: "Casey Kim",       number: "3",  classification: 1.5, status: "bench",   position: "Guard" },
  { name: "Riley Hassan",    number: "11", classification: 2.0, status: "bench",   position: "Forward" },
];

// ─── games ───────────────────────────────────────────────────────────────────
const GAMES = [
  { date: isoDate(-21), opponent: "Phoenix Suns Adaptive",  location: "AU Recreation Center",     status: "completed" },
  { date: isoDate(-14), opponent: "Desert Rollers",         location: "Desert Rollers Arena",     status: "completed" },
  { date: isoDate(-7),  opponent: "Tucson Roadrunners",     location: "AU Recreation Center",     status: "completed" },
  { date: isoDate(3),   opponent: "Mesa Blazers",           location: "AU Recreation Center",     status: "upcoming" },
  { date: isoDate(10),  opponent: "Flagstaff Falcons",      location: "Flagstaff Community Gym",  status: "upcoming" },
];

// ─── event templates ─────────────────────────────────────────────────────────
function buildEvents(gameId, playerIds, lineupIds) {
  // Simulate ~30 events spread across 40 in-game minutes
  const events = [];
  const actions = [
    { action_type: "made_2pt",   points: 2 },
    { action_type: "missed_2pt", points: 0 },
    { action_type: "made_3pt",   points: 3 },
    { action_type: "missed_3pt", points: 0 },
    { action_type: "made_ft",    points: 1 },
    { action_type: "missed_ft",  points: 0 },
    { action_type: "assist",     points: 0 },
    { action_type: "rebound",    points: 0 },
    { action_type: "turnover",   points: 0 },
    { action_type: "steal",      points: 0 },
  ];

  const shotZones = ["paint", "wing_left", "wing_right", "three_center", "three_left", "three_right", "mid_center"];

  for (let i = 0; i < 32; i++) {
    const action = actions[i % actions.length];
    const playerId = playerIds[i % playerIds.length];
    const isShot = action.action_type.includes("2pt") || action.action_type.includes("3pt") || action.action_type.includes("ft");

    const event = {
      timestamp: ts(40 - i * 1.2),   // spread over last 40 minutes
      game_id: gameId,
      player_id: playerId,
      action_type: action.action_type,
      points: action.points,
      lineup_on_court: lineupIds,
      is_opponent: false,
    };

    if (isShot) {
      const x = 20 + Math.random() * 60;
      const y = 30 + Math.random() * 60;
      event.shot_x = x;
      event.shot_y = y;
      event.shot_zone = shotZones[Math.floor(Math.random() * shotZones.length)];
    }

    events.push(event);
  }

  // Add ~10 opponent events
  for (let i = 0; i < 10; i++) {
    const oppActions = ["made_2pt", "missed_2pt", "made_3pt", "missed_3pt"];
    const action_type = oppActions[i % oppActions.length];
    const pts = action_type === "made_3pt" ? 3 : action_type === "made_2pt" ? 2 : 0;
    const x = 20 + Math.random() * 60;
    const y = 30 + Math.random() * 60;
    events.push({
      timestamp: ts(38 - i * 3.5),
      game_id: gameId,
      player_id: "opponent",
      action_type,
      points: pts,
      lineup_on_court: lineupIds,
      is_opponent: true,
      shot_x: x,
      shot_y: y,
      shot_zone: shotZones[Math.floor(Math.random() * shotZones.length)],
    });
  }

  return events;
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding test data against", BASE, "\n");

  // 1. Create players
  console.log("Creating players...");
  const createdPlayers = [];
  for (const p of PLAYERS) {
    const player = await post("/players", p);
    createdPlayers.push(player);
    console.log(`  ✓ ${player.name} (#${player.number})`);
  }

  const activePlayers = createdPlayers.filter(p => p.status === "active");
  const playerIds = activePlayers.map(p => p.id);
  const lineupIds = playerIds;

  // 2. Create games
  console.log("\nCreating games...");
  const createdGames = [];
  for (const g of GAMES) {
    const game = await post("/games", {
      ...g,
      opponent_players: [
        { id: `opp_1_${Date.now()}`, name: "Smith", number: "5" },
        { id: `opp_2_${Date.now()}`, name: "Jones", number: "12" },
        { id: `opp_3_${Date.now()}`, name: "Williams", number: "33" },
      ],
    });
    createdGames.push(game);
    console.log(`  ✓ vs ${game.opponent} (${game.date}) — ${game.status}`);
  }

  // 3. Create events for completed games
  const completedGames = createdGames.filter(g => g.status === "completed");
  console.log(`\nCreating events for ${completedGames.length} completed games...`);

  for (const game of completedGames) {
    const events = buildEvents(game.id, playerIds, lineupIds);
    let created = 0;
    for (const ev of events) {
      await post("/events", ev);
      created++;
    }
    // Compute scores and update game
    const ourScore = events.filter(e => !e.is_opponent).reduce((s, e) => s + (e.points || 0), 0);
    const oppScore = events.filter(e => e.is_opponent).reduce((s, e) => s + (e.points || 0), 0);
    await put(`/games/${game.id}`, { our_score: ourScore, opponent_score: oppScore });
    console.log(`  ✓ vs ${game.opponent}: ${ourScore}-${oppScore} (${created} events)`);
  }

  console.log("\n✅ Seed complete!");
  console.log(`   ${createdPlayers.length} players`);
  console.log(`   ${createdGames.length} games (${completedGames.length} completed)`);
  const totalEvents = completedGames.length * 42;
  console.log(`   ~${totalEvents} events`);
  console.log("\nOpen http://localhost:5173 to see the data.");
}

main().catch(err => {
  console.error("\n❌ Seed failed:", err.message);
  console.error("Make sure the API is running: func start --script-root api --port 7071");
  process.exit(1);
});
