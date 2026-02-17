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

export async function PUT(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { error: "Não autorizado" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { id } = params;
        const userId = (session.user as any).id;

        // Buscar a organização ativa do usuário
        const organizationId = await getActiveOrganizationId(userId);

        if (!organizationId) {
            return NextResponse.json(
                { error: "Organização não encontrada" },
                { status: 404 }
            );
        }

        // Verificar se a equipe pertence à organização do usuário
        const existingTeam = await prisma.team.findFirst({
            where: {
                id,
                organizationId,
            },
        });

        if (!existingTeam) {
            return NextResponse.json(
                { error: "Equipe não encontrada ou sem permissão" },
                { status: 404 }
            );
        }

        const team = await prisma.team.update({
            where: { id },
            data: body,
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
        console.log("[DELETE /api/teams/[id]] ========== Iniciando ==========");
        const session = await getServerSession(authOptions);
        console.log("[DELETE] Session exists:", !!session?.user);

        if (!session?.user) {
            console.log("[DELETE] ❌ 401 - Não autorizado");
            return NextResponse.json(
                { error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { id } = params;
        console.log("[DELETE] 🎯 Team ID to delete:", id);

        const userId = (session.user as any).id;
        console.log("[DELETE] 👤 User ID:", userId);

        // Buscar a organização ativa do usuário
        const organizationId = await getActiveOrganizationId(userId);
        console.log("[DELETE] 🏢 Organization ID:", organizationId);

        if (!organizationId) {
            console.log("[DELETE] ❌ 404 - Organização não encontrada para usuário");
            return NextResponse.json(
                { error: "Organização não encontrada" },
                { status: 404 }
            );
        }

        // Verificar se a equipe existe
        const team = await prisma.team.findUnique({
            where: { id },
        });
        console.log("[DELETE] 🔍 Team exists:", !!team);
        if (team) {
            console.log("[DELETE] 🔍 Team organizationId:", team.organizationId);
            console.log("[DELETE] 🔍 Matches user org:", team.organizationId === organizationId);
        }

        // Verificar se a equipe pertence à organização do usuário
        const existingTeam = await prisma.team.findFirst({
            where: {
                id,
                organizationId,
            },
        });
        console.log("[DELETE] ✓ Team found for this org:", !!existingTeam);

        if (!existingTeam) {
            console.log("[DELETE] ❌ 404 - Equipe não pertence a essa organização");
            return NextResponse.json(
                { error: "Equipe não encontrada ou sem permissão" },
                { status: 404 }
            );
        }

        await prisma.team.delete({
            where: { id },
        });

        console.log("[DELETE] ✅ Team deleted successfully");
        return NextResponse.json({ message: "Equipe deletada com sucesso" });
    } catch (error) {
        console.error("[DELETE] ❌ ERROR:", error);
        return NextResponse.json(
            { error: "Erro ao deletar equipe" },
            { status: 500 }
        );
    }
}
