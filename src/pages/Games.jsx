import React, { useState } from "react";
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calendar, MapPin, Pencil, Trash2, ChevronRight, Trophy, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function Games() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ date: new Date().toLocaleDateString("en-CA"), opponent: "", location: "", status: "upcoming" });
  const queryClient = useQueryClient();

  const { data: games = [] } = useQuery({
    queryKey: ["games"],
    queryFn: () => api.entities.Game.list("-date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.entities.Game.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["games"] }); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.entities.Game.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["games"] }); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.entities.Game.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games"] }),
  });

  const resetForm = () => {
    setForm({ date: new Date().toLocaleDateString("en-CA"), opponent: "", location: "", status: "upcoming" });
    setEditing(null);
    setOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const handleEdit = (game) => {
    setEditing(game);
    setForm({ date: game.date, opponent: game.opponent, location: game.location || "", status: game.status || "upcoming" });
    setOpen(true);
  };

  const upcoming = games.filter(g => g.status === "upcoming" || g.status === "live")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const completed = games.filter(g => g.status === "completed")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const statusColors = {
    upcoming: "bg-secondary text-secondary-foreground",
    live: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    completed: "bg-muted text-muted-foreground",
  };

  const GameCard = ({ game }) => (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 group">
      <div className="w-12 h-12 rounded-xl bg-secondary flex flex-col items-center justify-center flex-shrink-0">
        <span className="text-[10px] text-muted-foreground font-semibold">
          {game.date ? new Date(game.date + "T12:00:00").toLocaleDateString("en", { month: "short" }) : "—"}
        </span>
        <span className="text-lg font-black text-foreground leading-none">
          {game.date ? new Date(game.date + "T12:00:00").getDate() : "—"}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-foreground">vs {game.opponent}</p>
        {game.location && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin className="w-3 h-3" /> {game.location}
          </span>
        )}
      </div>

      <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full flex-shrink-0", statusColors[game.status || "upcoming"])}>
        {game.status || "upcoming"}
      </span>

      {game.status === "completed" && (
        <Link
          to={`/GameDetail?id=${game.id}`}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors flex-shrink-0"
        >
          Stats <ChevronRight className="w-3 h-3" />
        </Link>
      )}

      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => handleEdit(game)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <Pencil className="w-4 h-4 text-muted-foreground" />
        </button>
        <button onClick={() => deleteMutation.mutate(game.id)} className="p-2 rounded-lg hover:bg-destructive/20 transition-colors">
          <Trash2 className="w-4 h-4 text-destructive" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">Schedule</h1>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold">
              <Plus className="w-4 h-4 mr-2" /> Add Game
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Game" : "Add Game"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Opponent</Label>
                <Input value={form.opponent} onChange={e => setForm({ ...form, opponent: e.target.value })} required className="bg-secondary border-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="bg-secondary border-border" />
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground rounded-xl font-bold">
                {editing ? "Update" : "Create"} Game
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Upcoming / Live */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Upcoming</p>
          </div>
          {upcoming.map(game => <GameCard key={game.id} game={game} />)}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Results</p>
          </div>
          {completed.map(game => <GameCard key={game.id} game={game} />)}
        </div>
      )}

      {games.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No games scheduled yet</p>
        </div>
      )}

      {/* Season Record Summary */}
      {completed.length > 0 && <SeasonRecord games={completed} />}
    </div>
  );
}

function SeasonRecord({ games }) {
  const wins = games.filter(g => g.our_score > g.opponent_score).length;
  const losses = games.filter(g => g.our_score < g.opponent_score).length;
  const ties = games.filter(g => g.our_score === g.opponent_score).length;
  const totalPtsFor = games.reduce((s, g) => s + (g.our_score || 0), 0);
  const totalPtsAgainst = games.reduce((s, g) => s + (g.opponent_score || 0), 0);
  const avgPtsFor = games.length > 0 ? (totalPtsFor / games.length).toFixed(1) : "0.0";
  const avgPtsAgainst = games.length > 0 ? (totalPtsAgainst / games.length).toFixed(1) : "0.0";
  const winPct = games.length > 0 ? ((wins / games.length) * 100).toFixed(0) : "0";

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-primary" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Season Record</p>
      </div>

      {/* W-L-T */}
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <p className="text-4xl font-black text-emerald-400">{wins}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-1">Wins</p>
        </div>
        <div className="text-2xl font-bold text-muted-foreground">–</div>
        <div className="text-center">
          <p className="text-4xl font-black text-destructive">{losses}</p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-1">Losses</p>
        </div>
        {ties > 0 && (
          <>
            <div className="text-2xl font-bold text-muted-foreground">–</div>
            <div className="text-center">
              <p className="text-4xl font-black text-muted-foreground">{ties}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-1">Ties</p>
            </div>
          </>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
        <div className="text-center">
          <p className="text-lg font-black text-foreground">{winPct}%</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Win %</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-primary">{avgPtsFor}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg Pts For</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-foreground">{avgPtsAgainst}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg Pts Against</p>
        </div>
      </div>
    </div>
  );
}