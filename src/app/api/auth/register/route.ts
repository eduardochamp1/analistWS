import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
    try {
        const { name, email, password } = await request.json();

        // Validações
        if (!email || !password) {
            return NextResponse.json(
                { error: "Email e senha são obrigatórios" },
                { status: 400 }
            );
        }

        // Verificar se usuário já existe
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "Este email já está cadastrado" },
                { status: 400 }
            );
        }

        // Hash da senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Criar slug para organização pessoal
        const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");
        const timestamp = Date.now().toString(36);
        const organizationSlug = `${slug}-${timestamp}`;

        // Criar usuário e organização pessoal em uma transação
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Criar usuário
            const user = await tx.user.create({
                data: {
                    name: name || null,
                    email,
                    password: hashedPassword,
                    role: "VIEWER",
                },
            });

            // Criar organização pessoal
            const organization = await tx.organization.create({
                data: {
                    name: `${name || email.split("@")[0]} (Pessoal)`,
                    slug: organizationSlug,
                    isPersonal: true,
                },
            });

            // Vincular usuário à organização como OWNER
            await tx.organizationMember.create({
                data: {
                    userId: user.id,
                    organizationId: organization.id,
                    role: "OWNER",
                },
            });

            return { user, organization };
        });

        return NextResponse.json(
            {
                message: "Usuário e organização criados com sucesso",
                user: {
                    id: result.user.id,
                    name: result.user.name,
                    email: result.user.email,
                    role: result.user.role,
                },
                organization: {
                    id: result.organization.id,
                    name: result.organization.name,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Register error:", error);
        return NextResponse.json(
            { error: "Erro ao criar usuário" },
            { status: 500 }
        );
    }
}
