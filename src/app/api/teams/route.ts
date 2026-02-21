import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const teams = await prisma.team.findMany({
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(teams);
    } catch (error) {
        console.error("GET teams error:", error);
        return NextResponse.json(
            { error: "Erro interno ao buscar equipes" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, lat, lon, color, members, status, notes } = body;

        if (!name || lat === undefined || lon === undefined) {
            return NextResponse.json(
                { error: "Nome, latitude e longitude são obrigatórios" },
                { status: 400 }
            );
        }

        const team = await prisma.team.create({
            data: {
                name,
                lat,
                lon,
                color: color || "#3B82F6",
                members: members || 3,
                status: status || "AVAILABLE",
                notes,
            },
        });

        return NextResponse.json(team, { status: 201 });
    } catch (error) {
        console.error("POST team error:", error);
        return NextResponse.json(
            { error: "Erro ao criar equipe" },
            { status: 500 }
        );
    }
}
