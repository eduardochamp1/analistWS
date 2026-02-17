import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createOrganizationForExistingUsers() {
    console.log("🔍 Buscando usuários sem organização...");

    // Buscar todos os usuários
    const users = await prisma.user.findMany({
        include: {
            organizations: true,
        },
    });

    console.log(`📊 Total de usuários: ${users.length}`);

    for (const user of users) {
        // Verificar se usuário já tem organização
        if (user.organizations.length > 0) {
            console.log(`✓ ${user.email} já tem organização`);
            continue;
        }

        console.log(`🔧 Criando organização para ${user.email}...`);

        // Criar organização pessoal
        const organization = await prisma.organization.create({
            data: {
                name: `${user.name || user.email.split("@")[0]} (Pessoal)`,
                slug: `${user.email.split("@")[0]}-${Date.now()}`,
                isPersonal: true,
            },
        });

        // Criar membership
        await prisma.organizationMember.create({
            data: {
                userId: user.id,
                organizationId: organization.id,
                role: "OWNER",
            },
        });

        console.log(`✅ Organização criada: ${organization.name}`);
    }

    console.log("\n✅ Processo concluído!");
}

createOrganizationForExistingUsers()
    .catch((error) => {
        console.error("❌ Erro:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
