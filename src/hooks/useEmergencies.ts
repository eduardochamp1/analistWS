import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/contexts/ToastContext";

export interface EmergencyDB {
  id: string;
  name: string;
  lat: number;
  lon: number;
  severity: string;        // LOW | MEDIUM | HIGH | CRITICAL
  status: string;          // OPEN | IN_PROGRESS | RESOLVED | CANCELLED
  description: string | null;
  selectedTeamId: string | null;
  resolvedByTeamId: string | null; // Equipe que efetivamente concluiu
  createdAt: string;
  resolvedAt: string | null;
  updatedAt: string;
}

export type CreateEmergencyData = {
  name: string;
  lat: number;
  lon: number;
  severity?: string;
  status?: string;
  description?: string;
  selectedTeamId?: string | null;
};

export function useEmergencies() {
  const [emergencies, setEmergencies] = useState<EmergencyDB[]>([]);
  const [loading, setLoading] = useState(true);
  const { success, error } = useToast();

  const fetchEmergencies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/emergencies");
      if (!res.ok) throw new Error("Erro ao buscar emergências");
      const data: EmergencyDB[] = await res.json();
      // Mostra apenas abertas/em andamento na tela de gestão
      setEmergencies(data.filter((e) => e.status === "OPEN" || e.status === "IN_PROGRESS"));
    } catch {
      error("Erro ao carregar emergências");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    fetchEmergencies();
  }, [fetchEmergencies]);

  const createEmergency = useCallback(async (data: CreateEmergencyData): Promise<EmergencyDB | null> => {
    try {
      const res = await fetch("/api/emergencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, status: data.status ?? "OPEN", severity: data.severity ?? "MEDIUM" }),
      });
      if (!res.ok) throw new Error();
      const created: EmergencyDB = await res.json();
      setEmergencies((prev) => [created, ...prev]);
      success("Emergência registrada!");
      return created;
    } catch {
      error("Erro ao criar emergência");
      return null;
    }
  }, [success, error]);

  const updateEmergency = useCallback(async (id: string, updates: Partial<EmergencyDB>): Promise<EmergencyDB | null> => {
    // Optimistic
    setEmergencies((prev) => prev.map((e) => e.id === id ? { ...e, ...updates } : e));
    try {
      const res = await fetch(`/api/emergencies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
      const updated: EmergencyDB = await res.json();
      // Se resolvida/cancelada, remove da lista ativa
      if (updated.status === "RESOLVED" || updated.status === "CANCELLED") {
        setEmergencies((prev) => prev.filter((e) => e.id !== id));
        success(updated.status === "RESOLVED" ? "Emergência concluída!" : "Emergência cancelada!");
      } else {
        setEmergencies((prev) => prev.map((e) => e.id === id ? updated : e));
        success("Emergência atualizada!");
      }
      return updated;
    } catch {
      // Rollback
      fetchEmergencies();
      error("Erro ao atualizar emergência");
      return null;
    }
  }, [success, error, fetchEmergencies]);

  const removeEmergency = useCallback(async (id: string) => {
    setEmergencies((prev) => prev.filter((e) => e.id !== id));
    try {
      await fetch(`/api/emergencies/${id}`, { method: "DELETE" });
      success("Emergência removida");
    } catch {
      fetchEmergencies();
      error("Erro ao remover emergência");
    }
  }, [success, error, fetchEmergencies]);

  return {
    emergencies,
    loading,
    fetchEmergencies,
    createEmergency,
    updateEmergency,
    removeEmergency,
  };
}
