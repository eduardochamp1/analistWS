"use client";

import { useTeams } from "@/hooks/useTeams";
import { useState } from "react";

export default function TestPage() {
    const { teams, loading, createTeam, deleteTeam } = useTeams();
    const [apiResponse, setApiResponse] = useState<string>("");
    const [teamIdToDelete, setTeamIdToDelete] = useState<string>("");

    const testApiDirectly = async () => {
        try {
            const res = await fetch("/api/teams");
            const text = await res.text();
            setApiResponse(`Status: ${res.status}\nResponse: ${text}`);
        } catch (error) {
            setApiResponse(`Error: ${error}`);
        }
    };

    const testDeleteDirectly = async (teamId: string) => {
        try {
            setApiResponse(`⏳ Deletando team ${teamId}...`);
            const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
            const text = await res.text();
            setApiResponse(`Status: ${res.status}\nResponse: ${text}`);
        } catch (error) {
            setApiResponse(`❌ Error: ${error}`);
        }
    };

    const createOrganization = async () => {
        try {
            setApiResponse("⏳ Criando organização...");
            const res = await fetch("/api/fix-organization", { method: "POST" });
            const data = await res.json();
            setApiResponse(`✅ ${data.message}\n\n${JSON.stringify(data.organization || data, null, 2)}`);
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            setApiResponse(`❌ Error: ${error}`);
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Test useTeams Hook</h1>

            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="font-bold text-yellow-800 mb-2">⚠️ Problema: Usuário sem Organização?</p>
                <p className="text-sm text-yellow-700 mb-3">
                    Se não carregar teams, clique para criar organização:
                </p>
                <button
                    onClick={createOrganization}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-lg"
                >
                    🔧 Criar Organização Agora
                </button>
            </div>

            <div className="mb-4 p-4 bg-gray-100 rounded">
                <div className="flex gap-2 mb-2">
                    <button
                        onClick={testApiDirectly}
                        className="px-4 py-2 bg-purple-500 text-white rounded"
                    >
                        Test API /teams
                    </button>
                </div>
                {apiResponse && (
                    <pre className="mt-2 text-xs whitespace-pre-wrap bg-white p-2 rounded border">{apiResponse}</pre>
                )}
            </div>

            <div className="space-y-2">
                <p className="font-semibold">Teams loaded: {teams.length}</p>
                {teams.map(team => (
                    <div key={team.id} className="p-4 border rounded bg-white">
                        <h3 className="font-bold">{team.name}</h3>
                        <p className="text-sm text-gray-600">ID: {team.id}</p>
                        <p>Members: {team.members}</p>
                        <p>Color: {team.color}</p>
                        <div className="mt-2 flex gap-2">
                            <button
                                onClick={() => deleteTeam(team.id)}
                                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
                            >
                                Delete via Hook
                            </button>
                            <button
                                onClick={() => testDeleteDirectly(team.id)}
                                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded"
                            >
                                Test DELETE API
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={() => createTeam({
                    name: `Test Team ${Date.now()}`,
                    color: "#ff0000",
                    members: 5,
                    lat: -20.3155,
                    lon: -40.3128,
                })}
                className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
            >
                Add Test Team
            </button>
        </div>
    );
}
