import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/contexts/ToastContext";

export interface Team {
    id: string;
    name: string;
    color: string;
    members: number;
    lat: number;
    lon: number;
    available?: boolean;
    status?: string;
}

export function useTeams() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const { success, error } = useToast();

    // Transform API response to frontend format
    const transformTeam = (team: any): Team => ({
        id: team.id,
        name: team.name,
        color: team.color,
        members: team.members,
        lat: team.lat,
        lon: team.lon,
        available: team.status === "AVAILABLE" || team.available === true,
        status: team.status,
    });

    // Fetch teams from API
    const fetchTeams = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/teams");

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errorMessage = errorData.error || `Erro ${res.status}: Falha ao buscar dados`;
                console.error("[useTeams] Fetch error:", res.status, errorMessage);
                throw new Error(errorMessage);
            }

            const data = await res.json();
            const transformedTeams = data.map(transformTeam);
            setTeams(transformedTeams);
        } catch (err) {
            console.error("Erro ao buscar teams:", err);
            error("Erro ao carregar equipes");
        } finally {
            setLoading(false);
        }
    }, [error]);

    // Load teams on mount
    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    // Create team
    const createTeam = useCallback(async (teamData: Omit<Team, "id" | "available">) => {
        const tempId = `temp-${Date.now()}`;
        const optimisticTeam: Team = {
            ...teamData,
            id: tempId,
            available: true,
        };

        // Optimistic update
        setTeams((prev) => [...prev, optimisticTeam]);

        try {
            const res = await fetch("/api/teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(teamData),
            });

            if (!res.ok) {
                throw new Error("Erro ao criar equipe");
            }

            const newTeam = await res.json();
            const transformedTeam = transformTeam(newTeam);

            // Replace temp with real data
            setTeams((prev) => prev.map((t) => (t.id === tempId ? transformedTeam : t)));

            success("Equipe criada com sucesso!");
            return transformedTeam;
        } catch (err) {
            console.error("Erro ao criar team:", err);
            // Rollback optimistic update
            setTeams((prev) => prev.filter((t) => t.id !== tempId));
            error("Erro ao criar equipe");
            throw err;
        }
    }, [success, error]);

    // Update team
    const updateTeam = useCallback(async (id: string, updates: Partial<Team>) => {
        // Store old state for rollback
        const oldTeams = teams;

        // Optimistic update
        setTeams((prev) =>
            prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
        );

        try {
            const res = await fetch(`/api/teams/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });

            if (!res.ok) {
                throw new Error("Erro ao atualizar equipe");
            }

            const updatedTeam = await res.json();
            const transformedTeam = transformTeam(updatedTeam);

            // Update with real data from server
            setTeams((prev) => prev.map((t) => (t.id === id ? transformedTeam : t)));

            success("Equipe atualizada!");
            return transformedTeam;
        } catch (err) {
            console.error("Erro ao atualizar team:", err);
            // Rollback
            setTeams(oldTeams);
            error("Erro ao atualizar equipe");
            throw err;
        }
    }, [teams, success, error]);

    // Delete team
    const deleteTeam = useCallback(async (id: string) => {
        // Store old state for rollback
        const oldTeams = teams;

        // Optimistic update
        setTeams((prev) => prev.filter((t) => t.id !== id));

        try {
            const res = await fetch(`/api/teams/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                throw new Error("Erro ao deletar equipe");
            }

            success("Equipe removida!");
        } catch (err) {
            console.error("Erro ao deletar team:", err);
            // Rollback
            setTeams(oldTeams);
            error("Erro ao deletar equipe");
            throw err;
        }
    }, [teams, success, error]);

    return {
        teams,
        loading,
        fetchTeams,
        createTeam,
        updateTeam,
        deleteTeam,
    };
}
