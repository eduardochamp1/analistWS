"use client";

import { useState, useEffect, useCallback } from "react";
import {
  History,
  Siren,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface EmergencyRecord {
  id: string;
  name: string;
  lat: number;
  lon: number;
  severity: string;
  status: string;
  description: string | null;
  selectedTeamId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  updatedAt: string;
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberta",
  IN_PROGRESS: "Em andamento",
  RESOLVED: "Resolvida",
  CANCELLED: "Cancelada",
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-blue-100 text-blue-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-muted",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "RESOLVED") return <CheckCircle2 size={14} className="text-green-600" />;
  if (status === "IN_PROGRESS") return <Clock size={14} className="text-amber-600" />;
  if (status === "CANCELLED") return <XCircle size={14} className="text-muted" />;
  return <AlertTriangle size={14} className="text-red-600" />;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calcDuration(createdAt: string, resolvedAt: string | null): string {
  const end = resolvedAt ? new Date(resolvedAt) : new Date();
  const start = new Date(createdAt);
  const diffMs = end.getTime() - start.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins > 0 ? ` ${mins}min` : ""}`;
}

export default function HistoricoPage() {
  const [records, setRecords] = useState<EmergencyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { success, error: errorToast } = useToast();

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/emergencies");
      if (!res.ok) throw new Error("Erro ao buscar histórico");
      const data = await res.json();
      setRecords(data);
    } catch {
      errorToast("Erro ao carregar histórico de emergências");
    } finally {
      setLoading(false);
    }
  }, [errorToast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const body: Record<string, unknown> = { status: newStatus };
      if (newStatus === "RESOLVED") {
        body.resolvedAt = new Date().toISOString();
      } else if (newStatus === "OPEN" || newStatus === "IN_PROGRESS") {
        body.resolvedAt = null;
      }
      const res = await fetch(`/api/emergencies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
      success(`Status atualizado para "${STATUS_LABELS[newStatus]}"`);
    } catch {
      errorToast("Erro ao atualizar status");
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const res = await fetch(`/api/emergencies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setDeleteId(null);
      success("Registro removido");
    } catch {
      errorToast("Erro ao remover registro");
    }
  };

  const filtered = records.filter((r) => {
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
    if (filterSeverity !== "ALL" && r.severity !== filterSeverity) return false;
    return true;
  });

  // Stats
  const total = records.length;
  const open = records.filter((r) => r.status === "OPEN").length;
  const inProgress = records.filter((r) => r.status === "IN_PROGRESS").length;
  const resolved = records.filter((r) => r.status === "RESOLVED").length;

  const toDelete = records.find((r) => r.id === deleteId);

  return (
    <div>
      <ConfirmDialog
        open={!!deleteId}
        title="Remover registro"
        message={`Tem certeza que deseja remover o registro "${toDelete?.name || ""}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={() => deleteId && deleteRecord(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History size={28} className="text-accent" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Histórico de Emergências</h1>
            <p className="text-sm text-muted">Timeline de todas as ocorrências registradas</p>
          </div>
        </div>
        <button
          onClick={fetchRecords}
          className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: total, color: "text-foreground", bg: "bg-card-bg" },
          { label: "Abertas", value: open, color: "text-red-600", bg: "bg-red-50" },
          { label: "Em andamento", value: inProgress, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Resolvidas", value: resolved, color: "text-green-600", bg: "bg-green-50" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "rounded-xl border border-card-border p-4",
              stat.bg
            )}
          >
            <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted" />
          <span className="text-sm text-muted">Filtrar:</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-card-border bg-card-bg px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="ALL">Todos</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">Severidade:</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-md border border-card-border bg-card-bg px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
          >
            <option value="ALL">Todas</option>
            {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {(filterStatus !== "ALL" || filterSeverity !== "ALL") && (
          <button
            onClick={() => { setFilterStatus("ALL"); setFilterSeverity("ALL"); }}
            className="text-xs text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary/50" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-card-border">
          <Siren size={32} className="text-muted/40" />
          <p className="text-sm text-muted">
            {records.length === 0
              ? "Nenhuma emergência registrada"
              : "Nenhum resultado para os filtros aplicados"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => (
            <div
              key={record.id}
              className="rounded-xl border border-card-border bg-card-bg p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Info principal */}
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                    <Siren size={14} className="text-red-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-foreground">
                        {record.name}
                      </p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", SEVERITY_COLORS[record.severity] || "bg-gray-100 text-muted")}>
                        {SEVERITY_LABELS[record.severity] || record.severity}
                      </span>
                      <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COLORS[record.status] || "bg-gray-100 text-muted")}>
                        <StatusIcon status={record.status} />
                        {STATUS_LABELS[record.status] || record.status}
                      </span>
                    </div>
                    {record.description && (
                      <p className="mt-1 text-sm text-muted">{record.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                      <span>📅 Aberta: {formatDate(record.createdAt)}</span>
                      {record.resolvedAt && (
                        <span>✅ Resolvida: {formatDate(record.resolvedAt)}</span>
                      )}
                      <span>⏱ Duração: {calcDuration(record.createdAt, record.resolvedAt)}</span>
                      <span>📍 ({record.lat.toFixed(4)}, {record.lon.toFixed(4)})</span>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={record.status}
                    onChange={(e) => updateStatus(record.id, e.target.value)}
                    disabled={updatingId === record.id}
                    className="rounded-md border border-card-border bg-card-bg px-2 py-1 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  {updatingId === record.id && (
                    <Loader2 size={14} className="animate-spin text-primary/50" />
                  )}
                  <button
                    onClick={() => setDeleteId(record.id)}
                    className="p-1.5 text-muted hover:text-red-500"
                    aria-label="Remover"
                    title="Remover registro"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
