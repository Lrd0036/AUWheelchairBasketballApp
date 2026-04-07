import React, { useState, useMemo } from "react";
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CourtMap from "@/components/court/CourtMap";
import ShotResultModal from "@/components/court/ShotResultModal";
import OpponentShotModal from "@/components/court/OpponentShotModal";
import ActivePlayerSelector from "@/components/live/ActivePlayerSelector";
import QuickStatBar from "@/components/live/QuickStatBar";
import LineupManager from "@/components/live/LineupManager";
import ScoreHeader from "@/components/live/ScoreHeader";
import OpponentScoreControl from "@/components/live/OpponentScoreControl";
import { computePlayerStats } from "@/lib/statUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Undo2, Shield, Target, CheckCircle2, Plus, X, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LiveGame() {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedOppPlayer, setSelectedOppPlayer] = useState(null);
  const [pendingShot, setPendingShot] = useState(null);
  const [pendingOppShot, setPendingOppShot] = useState(null);
  const [courtMode, setCourtMode] = useState("our");
  const [opponentScore, setOpponentScore] = useState(0);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [newOppName, setNewOppName] = useState("");
  const [newOppNum, setNewOppNum] = useState("");
  const [showAddOpp, setShowAddOpp] = useState(false);
  const queryClient = useQueryClient();

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => api.entities.Player.list(),
  });

  const { data: games = [] } = useQuery({
    queryKey: ["games"],
    queryFn: () => api.entities.Game.list("-date"),
  });

  // Only auto-select a live game — do NOT default to games[0]
  const activeGame = games.find(g => g.id === selectedGameId) || games.find(g => g.status === "live");
  const isReadOnly = activeGame?.status === "completed";
  const oppPlayers = activeGame?.opponent_players || [];

  const { data: events = [] } = useQuery({
    queryKey: ["events", activeGame?.id],
    queryFn: () => activeGame ? api.entities.Event.filter({ game_id: activeGame.id }) : [],
    enabled: !!activeGame,
    refetchInterval: 10000,
  });

  const activePlayers = players.filter(p => p.status === "active");
  const benchPlayers = players.filter(p => p.status === "bench");
  const classificationSum = activePlayers.reduce((sum, p) => sum + (p.classification || 0), 0);
  const activeLineupIds = activePlayers.map(p => p.id);

  const ourEvents = events.filter(e => !e.is_opponent);
  const oppEvents = events.filter(e => e.is_opponent);
  const ourScore = useMemo(() => ourEvents.reduce((s, e) => s + (e.points || 0), 0), [ourEvents]);

  const createEvent = useMutation({
    mutationFn: (data) => api.entities.Event.create(data),
    onSuccess: (newEvent) => {
      if (activeGame?.id) {
        queryClient.setQueryData(["events", activeGame.id], (/** @type {any[]} */ old = []) => [...old, newEvent]);
        queryClient.invalidateQueries({ queryKey: ["events", activeGame.id] });
      }
    },
  });

  const undoEvent = useMutation({
    mutationFn: (id) => api.entities.Event.delete(id),
    onSuccess: (deletedId) => {
      if (activeGame?.id) {
        queryClient.setQueryData(["events", activeGame.id], (/** @type {any[]} */ old = []) => old.filter(ev => ev.id !== deletedId));
        queryClient.invalidateQueries({ queryKey: ["events", activeGame.id] });
      }
    },
  });

  const updateGame = useMutation({
    mutationFn: (data) => api.entities.Game.update(activeGame.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games"] }),
  });

  const endGame = useMutation({
    mutationFn: () => api.entities.Game.update(activeGame.id, { status: "completed" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games"] }),
  });

  const playerStats = useMemo(() => {
    const statsMap = {};
    activePlayers.forEach(p => {
      statsMap[p.id] = computePlayerStats(ourEvents, p.id);
    });
    return statsMap;
  }, [ourEvents, activePlayers]);

  const handleCourtTap = ({ x, y, zone }) => {
    if (isReadOnly) return;
    if (courtMode === "opponent") {
      setPendingOppShot({ x, y, zone });
    } else {
      if (!selectedPlayer) return;
      setPendingShot({ x, y, zone });
    }
  };

  const handleShotResult = (actionType, points) => {
    if (isReadOnly || !activeGame || !selectedPlayer || !pendingShot) return;
    createEvent.mutate({
      timestamp: new Date().toISOString(),
      player_id: selectedPlayer.id,
      game_id: activeGame.id,
      action_type: actionType,
      points,
      lineup_on_court: activeLineupIds,
      shot_x: pendingShot.x,
      shot_y: pendingShot.y,
      shot_zone: pendingShot.zone,
      is_opponent: false,
    });
    setPendingShot(null);
  };

  const handleOppShotResult = (actionType, points) => {
    if (isReadOnly || !activeGame || !pendingOppShot) return;
    const playerId = selectedOppPlayer?.id || activePlayers[0]?.id || "opponent";
    createEvent.mutate({
      timestamp: new Date().toISOString(),
      player_id: playerId,
      game_id: activeGame.id,
      action_type: actionType,
      points: 0,
      lineup_on_court: activeLineupIds,
      shot_x: pendingOppShot.x,
      shot_y: pendingOppShot.y,
      shot_zone: pendingOppShot.zone,
      is_opponent: true,
    });
    setOpponentScore(prev => prev + points);
    setPendingOppShot(null);
  };

  const handleQuickStat = (actionType, points) => {
    if (isReadOnly || !activeGame || !selectedPlayer) return;
    createEvent.mutate({
      timestamp: new Date().toISOString(),
      player_id: selectedPlayer.id,
      game_id: activeGame.id,
      action_type: actionType,
      points,
      lineup_on_court: activeLineupIds,
      is_opponent: false,
    });
  };

  const handleSub = async (outPlayer, inPlayer) => {
    if (isReadOnly) return;
    await api.entities.Player.update(outPlayer.id, { status: "bench" });
    await api.entities.Player.update(inPlayer.id, { status: "active" });
    queryClient.invalidateQueries({ queryKey: ["players"] });
    setSelectedPlayer(null);
  };

  const handleUndo = () => {
    if (isReadOnly || events.length === 0) return;
    const sorted = [...events].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
    undoEvent.mutate(sorted[0].id);
  };

  const handleAddOppPlayer = () => {
    if (!newOppName.trim()) return;
    const newPlayer = { id: `opp_${Date.now()}`, name: newOppName.trim(), number: newOppNum.trim() || "?" };
    updateGame.mutate({ opponent_players: [...oppPlayers, newPlayer] });
    setNewOppName("");
    setNewOppNum("");
    setShowAddOpp(false);
  };

  const handleRemoveOppPlayer = (id) => {
    updateGame.mutate({ opponent_players: oppPlayers.filter(p => p.id !== id) });
    if (selectedOppPlayer?.id === id) setSelectedOppPlayer(null);
  };

  const shotEvents = ourEvents.filter(e => e.shot_x !== undefined && e.shot_x !== null);
  const oppShotEvents = oppEvents.filter(e => e.shot_x !== undefined && e.shot_x !== null);

  // Empty state — no game selected and no live game found
  if (!activeGame) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <h1 className="text-2xl font-black tracking-tight">Sideline Tracker</h1>
        <div className="text-center py-24 text-muted-foreground space-y-5">
          <Shield className="w-14 h-14 mx-auto opacity-20" />
          <div>
            <p className="text-lg font-semibold text-foreground">No live game in progress</p>
            <p className="text-sm mt-1">Select a game below to view stats or begin tracking</p>
          </div>
          <div className="flex justify-center">
            <Select value="" onValueChange={(v) => setSelectedGameId(v)}>
              <SelectTrigger className="w-72 bg-card border-border">
                <SelectValue placeholder="Select a game..." />
              </SelectTrigger>
              <SelectContent>
                {games.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    vs {g.opponent} — {g.date} ({g.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Sideline Tracker</h1>
        <div className="flex items-center gap-2">
          <Select value={activeGame?.id || ""} onValueChange={(v) => setSelectedGameId(v)}>
            <SelectTrigger className="w-52 bg-card border-border">
              <SelectValue placeholder="Select game" />
            </SelectTrigger>
            <SelectContent>
              {games.map(g => (
                <SelectItem key={g.id} value={g.id}>vs {g.opponent} — {g.date}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isReadOnly && (
            <>
              <button
                onClick={() => { if (window.confirm("End this game and mark it as completed?")) endGame.mutate(); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-800/40 hover:bg-emerald-700/50 border border-emerald-700/40 text-emerald-400 text-sm font-bold transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" /> End Game
              </button>
              <button onClick={handleUndo} disabled={events.length === 0}
                className="p-2.5 rounded-xl bg-secondary hover:bg-destructive/20 transition-colors disabled:opacity-30" title="Undo">
                <Undo2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="bg-muted/60 border border-border rounded-xl p-3 flex items-center gap-2 text-muted-foreground text-sm">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>This game has ended — viewing in read-only mode. Visit <strong>Game Detail</strong> for full analytics.</span>
        </div>
      )}

      {/* Score */}
      <ScoreHeader game={activeGame} ourScore={ourScore} opponentScore={opponentScore} />

      {/* Live controls — hidden when read-only */}
      {!isReadOnly && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <LineupManager activePlayers={activePlayers} benchPlayers={benchPlayers} onSub={handleSub} classificationSum={classificationSum} />
            <OpponentScoreControl score={opponentScore} onChange={setOpponentScore} />
          </div>

          {activePlayers.length > 0 && courtMode === "our" && (
            <ActivePlayerSelector
              players={activePlayers}
              selectedPlayer={selectedPlayer}
              onSelect={setSelectedPlayer}
              stats={playerStats}
            />
          )}

          {/* Court Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => { setCourtMode("our"); setSelectedOppPlayer(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                courtMode === "our" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              <Target className="w-4 h-4" /> Record Our Shot
            </button>
            <button
              onClick={() => { setCourtMode("opponent"); setSelectedPlayer(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                courtMode === "opponent" ? "bg-purple-700 text-white" : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              <Shield className="w-4 h-4" /> Track Opponent Shot
            </button>
          </div>

          {/* Opponent Player Selector (opponent mode only) */}
          {courtMode === "opponent" && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold">Opponent Players (optional)</p>
              <div className="flex flex-wrap gap-2 items-center">
                {oppPlayers.map(p => (
                  <div key={p.id} className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedOppPlayer(selectedOppPlayer?.id === p.id ? null : p)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-sm font-bold transition-all border-2",
                        selectedOppPlayer?.id === p.id
                          ? "border-purple-500 bg-purple-500/15 text-purple-300"
                          : "border-border bg-card text-muted-foreground hover:border-purple-500/40"
                      )}
                    >
                      #{p.number} {p.name}
                    </button>
                    <button onClick={() => handleRemoveOppPlayer(p.id)} className="p-0.5 text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {showAddOpp ? (
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="#"
                      value={newOppNum}
                      onChange={e => setNewOppNum(e.target.value)}
                      className="w-12 h-8 text-sm bg-secondary border-border"
                    />
                    <Input
                      placeholder="Name"
                      value={newOppName}
                      onChange={e => setNewOppName(e.target.value)}
                      className="w-32 h-8 text-sm bg-secondary border-border"
                      onKeyDown={e => e.key === "Enter" && handleAddOppPlayer()}
                      autoFocus
                    />
                    <button onClick={handleAddOppPlayer} className="px-2 py-1 text-xs font-bold bg-purple-700 text-white rounded-lg hover:bg-purple-600">Add</button>
                    <button onClick={() => { setShowAddOpp(false); setNewOppName(""); setNewOppNum(""); }} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddOpp(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Player
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Main Layout */}
      {isReadOnly ? (
        // Read-only: show both court overviews side by side
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Team Shot Overview</p>
              <CourtMap shots={shotEvents} opponentShots={[]} showHeatMap={false} readOnly={true} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold">Opponent Shot Overview</p>
              <CourtMap shots={[]} opponentShots={oppShotEvents} showHeatMap={false} readOnly={true} />
            </div>
          </div>
          {/* Recent Events */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Event Log</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {[...events].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).map(ev => {
                const p = players.find(pl => pl.id === ev.player_id);
                const oppP = ev.is_opponent ? oppPlayers.find(op => op.id === ev.player_id) : null;
                return (
                  <div key={ev.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                    {ev.is_opponent
                      ? <span className="font-bold text-purple-400">{oppP ? `#${oppP.number}` : "OPP"}</span>
                      : <span className="font-black text-primary">#{p?.number}</span>
                    }
                    <span className="text-muted-foreground capitalize">{ev.action_type.replace(/_/g, " ")}</span>
                    {ev.points > 0 && <span className="text-emerald-400 font-bold ml-auto">+{ev.points}</span>}
                  </div>
                );
              })}
              {events.length === 0 && <p className="text-xs text-muted-foreground">No events recorded</p>}
            </div>
          </div>
        </div>
      ) : (
        // Live mode: interactive court + sidebar
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Interactive court — always empty for clean tapping */}
            <CourtMap
              onShotClick={handleCourtTap}
              shots={[]}
              opponentShots={[]}
            />
            {courtMode === "our" && (
              <p className="text-center text-xs text-muted-foreground -mt-2">
                {selectedPlayer
                  ? `Tap the court to record a shot for #${selectedPlayer.number} ${selectedPlayer.name}`
                  : "Select a player first, then tap the court"}
              </p>
            )}
            {courtMode === "opponent" && (
              <p className="text-center text-xs text-purple-400 -mt-2">
                {selectedOppPlayer
                  ? `Recording for #${selectedOppPlayer.number} ${selectedOppPlayer.name} — tap the court`
                  : "Tap the court to record opponent shot location"}
              </p>
            )}

            {/* Read-only overview charts */}
            {courtMode === "our" && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Team Shot Overview</p>
                <CourtMap shots={shotEvents} opponentShots={[]} showHeatMap={false} readOnly={true} />
              </div>
            )}
            {courtMode === "opponent" && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold">Opponent Shot Overview</p>
                <CourtMap shots={[]} opponentShots={oppShotEvents} showHeatMap={false} readOnly={true} />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <QuickStatBar selectedPlayer={selectedPlayer} onAction={handleQuickStat} />
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Recent</p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {[...events]
                  .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
                  .slice(0, 10)
                  .map(ev => {
                    const p = players.find(pl => pl.id === ev.player_id);
                    const oppP = ev.is_opponent ? oppPlayers.find(op => op.id === ev.player_id) : null;
                    return (
                      <div key={ev.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                        {ev.is_opponent
                          ? <span className="font-bold text-purple-400">{oppP ? `#${oppP.number}` : "OPP"}</span>
                          : <span className="font-black text-primary">#{p?.number}</span>
                        }
                        <span className="text-muted-foreground capitalize">{ev.action_type.replace(/_/g, " ")}</span>
                        {ev.points > 0 && <span className="text-emerald-400 font-bold ml-auto">+{ev.points}</span>}
                      </div>
                    );
                  })}
                {events.length === 0 && <p className="text-xs text-muted-foreground">No events yet</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shot Modals — only when live */}
      {!isReadOnly && (
        <>
          <ShotResultModal
            shotLocation={pendingShot}
            player={selectedPlayer}
            onResult={handleShotResult}
            onCancel={() => setPendingShot(null)}
          />
          <OpponentShotModal
            shotLocation={pendingOppShot}
            onResult={handleOppShotResult}
            onCancel={() => setPendingOppShot(null)}
          />
        </>
      )}
    </div>
  );
}