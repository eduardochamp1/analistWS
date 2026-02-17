import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

async function getActiveOrganizationId(userId: string): Promise<string | null> {
    const membership = await prisma.organizationMember.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
    });
    return membership?.organizationId || null;
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { error: "Não autorizado" },
                { status: 401 }
            );
        }

        const userId = (session.user as any).id;
        const organizationId = await getActiveOrganizationId(userId);

        if (!organizationId) {
            return NextResponse.json(
                { error: "Nenhuma organização encontrada" },
                { status: 404 }
            );
        }

        const emergencies = await prisma.emergency.findMany({
            where: {
                organizationId,
            },
            orderBy: {
                createdAt: "desc",
            },
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
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { error: "Não autorizado" },
                { status: 401 }
            );
        }

        const userId = (session.user as any).id;
        const organizationId = await getActiveOrganizationId(userId);

        if (!organizationId) {
            return NextResponse.json(
                { error: "Nenhuma organização encontrada" },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { name, lat, lon, severity, status, description, selectedTeamId } = body;

        // Validação básica
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
                userId,
                organizationId,
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
