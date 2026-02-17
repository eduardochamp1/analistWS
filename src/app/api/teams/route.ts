import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Helper para pegar organização ativa do usuário
async function getActiveOrganizationId(userId: string): Promise<string | null> {
    // 1. Tentar achar uma organização que o usuário já é membro
    const membership = await prisma.organizationMember.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
    });

    if (membership) {
        return membership.organizationId;
    }

    // 2. Se não tiver nenhuma, criar uma organização padrão (Lazy Creation)
    try {
        console.log(`[getActiveOrganizationId] Usuário ${userId} sem organização. Criando padrão...`);

        // Verificar se usuário existe (apenas por segurança)
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return null;

        const orgName = user.name ? `Organização de ${user.name}` : "Minha Organização";

        // Criar organização e membro em uma transação
        const newOrg = await prisma.organization.create({
            data: {
                name: orgName,
                slug: `${user.email.split("@")[0]}-${Date.now()}`,
                isPersonal: true,
                members: {
                    create: {
                        userId: userId,
                        role: "OWNER",
                    }
                }
            }
        });

        console.log(`[getActiveOrganizationId] Organização criada: ${newOrg.id}`);
        return newOrg.id;

    } catch (error) {
        console.error("[getActiveOrganizationId] Erro ao criar organização automática:", error);
        return null;
    }
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
        console.log(`[GET /api/teams] User: ${userId}`);

        const organizationId = await getActiveOrganizationId(userId);

        if (!organizationId) {
            console.warn(`[GET /api/teams] 404 - Nenhuma organização encontrada para user ${userId}`);
            return NextResponse.json(
                { error: "Nenhuma organização encontrada. Entre em contato com o suporte." },
                { status: 404 }
            );
        }

        const teams = await prisma.team.findMany({
            where: {
                organizationId,
            },
            orderBy: {
                createdAt: "desc",
            },
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
        const { name, lat, lon, color, members, status, notes } = body;

        // Validação básica
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
                userId, // Criador
                organizationId, // Vinculado à organização
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
