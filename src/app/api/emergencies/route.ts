import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const emergencies = await prisma.emergency.findMany({
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(emergencies);
    } catch (error) {
        console.error("GET emergencies error:", error);
        return NextResponse.json(
            { error: "Erro ao buscar emergências" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, lat, lon, severity, status, description, selectedTeamId } = body;

        if (!name || lat === undefined || lon === undefined) {
            return NextResponse.json(
                { error: "Nome, latitude e longitude são obrigatórios" },
                { status: 400 }
            );
        }

        const emergency = await prisma.emergency.create({
            data: {
                name,
                lat,
                lon,
                severity: severity || "MEDIUM",
                status: status || "OPEN",
                description,
                selectedTeamId,
            },
        });

        return NextResponse.json(emergency, { status: 201 });
    } catch (error) {
        console.error("POST emergency error:", error);
        return NextResponse.json(
            { error: "Erro ao criar emergência" },
            { status: 500 }
        );
    }
}
