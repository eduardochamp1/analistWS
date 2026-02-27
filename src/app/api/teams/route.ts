import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const unit = request.nextUrl.searchParams.get("unit") ?? "CCM";
        const teams = await prisma.$queryRaw`
            SELECT id, name, lat, lon, color, members, status, notes, unit,
                   "createdAt", "updatedAt"
            FROM "Team"
            WHERE unit = ${unit}
            ORDER BY "createdAt" DESC
        `;
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
        const { name, lat, lon, color, members, status, notes, unit } = body;

        if (!name || lat === undefined || lon === undefined) {
            return NextResponse.json(
                { error: "Nome, latitude e longitude são obrigatórios" },
                { status: 400 }
            );
        }

        // Cria a equipe sem o campo unit (usa o default "CCM" do banco)
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

        // Atualiza unit via SQL raw se não for o default
        const resolvedUnit = unit || "CCM";
        if (resolvedUnit !== "CCM") {
            await prisma.$executeRaw`UPDATE "Team" SET unit = ${resolvedUnit} WHERE id = ${team.id}`;
        }

        return NextResponse.json({ ...team, unit: resolvedUnit }, { status: 201 });
    } catch (error) {
        console.error("POST team error:", error);
        return NextResponse.json(
            { error: "Erro ao criar equipe" },
            { status: 500 }
        );
    }
}
