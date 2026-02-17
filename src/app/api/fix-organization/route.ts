import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Endpoint temporário para criar organização para usuário logado que não tem
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

        // Verificar se já tem organização
        const existingMembership = await prisma.organizationMember.findFirst({
            where: { userId },
        });

        if (existingMembership) {
            return NextResponse.json({
                message: "Usuário já possui organização",
                organizationId: existingMembership.organizationId,
            });
        }

        // Criar organização pessoal
        const organization = await prisma.organization.create({
            data: {
                name: `${session.user.name || session.user.email?.split("@")[0]} (Pessoal)`,
                slug: `${session.user.email?.split("@")[0]}-${Date.now()}`,
                isPersonal: true,
            },
        });

        // Criar membership
        await prisma.organizationMember.create({
            data: {
                userId,
                organizationId: organization.id,
                role: "OWNER",
            },
        });

        console.log(`[FIX-ORG] Organização criada para user ${userId}: ${organization.id}`);

        return NextResponse.json({
            message: "Organização criada com sucesso!",
            organization: {
                id: organization.id,
                name: organization.name,
            },
        });
    } catch (error) {
        console.error("[FIX-ORG] Error:", error);
        return NextResponse.json(
            { error: "Erro ao criar organização" },
            { status: 500 }
        );
    }
}
