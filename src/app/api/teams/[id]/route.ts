import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const { id } = params;
        const body = await request.json();

        const existingTeam = await prisma.team.findUnique({ where: { id } });

        if (!existingTeam) {
            return NextResponse.json(
                { error: "Equipe não encontrada" },
                { status: 404 }
            );
        }

        // Somente campos editáveis do schema são aceitos — nunca passa body bruto ao Prisma
        const { name, lat, lon, color, members, status, notes } = body;
        const team = await prisma.team.update({
            where: { id },
            data: {
                ...(name    !== undefined && { name }),
                ...(lat     !== undefined && { lat }),
                ...(lon     !== undefined && { lon }),
                ...(color   !== undefined && { color }),
                ...(members !== undefined && { members }),
                ...(status  !== undefined && { status }),
                ...(notes   !== undefined && { notes }),
            },
        });

        return NextResponse.json(team);
    } catch (error) {
        console.error("PUT team error:", error);
        return NextResponse.json(
            { error: "Erro ao atualizar equipe" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const { id } = params;

        const existingTeam = await prisma.team.findUnique({ where: { id } });

        if (!existingTeam) {
            return NextResponse.json(
                { error: "Equipe não encontrada" },
                { status: 404 }
            );
        }

        await prisma.team.delete({ where: { id } });

        return NextResponse.json({ message: "Equipe deletada com sucesso" });
    } catch (error) {
        console.error("DELETE team error:", error);
        return NextResponse.json(
            { error: "Erro ao deletar equipe" },
            { status: 500 }
        );
    }
}
