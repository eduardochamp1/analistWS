import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

interface EmployeeInput {
    name: string;
    role?: string;
    uen?: string;
    matricula?: string;
    admissao?: string;
    local?: string;
    situacao?: string;
}

export async function GET(request: NextRequest) {
    try {
        const unit = request.nextUrl.searchParams.get("unit") ?? "CCM";
        const employees = await prisma.$queryRaw`
            SELECT id, name, role, uen, matricula, admissao, local, situacao, unit,
                   "asoExpiry", "vacationDeadline", "vacationStart", "vacationEnd"
            FROM funcionarios
            WHERE unit = ${unit}
            ORDER BY name ASC
        `;
        return NextResponse.json(employees);
    } catch (error) {
        console.error("GET employees error:", error);
        return NextResponse.json({ error: "Erro ao buscar funcionários" }, { status: 500 });
    }
}

// POST replaces all employees for the given unit (bulk import)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { employees, unit = "CCM" } = body as { employees: EmployeeInput[]; unit?: string };

        if (!Array.isArray(employees)) {
            return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
        }

        // Delete existing, then bulk-insert in a single statement (much faster than per-row loop)
        await prisma.$executeRaw`DELETE FROM funcionarios WHERE unit = ${unit}`;

        if (employees.length > 0) {
            const now = new Date();
            const rows = employees.map((emp) =>
                Prisma.sql`(
                    ${randomUUID()},
                    ${emp.name},
                    ${emp.role ?? null},
                    ${emp.uen ?? null},
                    ${emp.matricula ?? null},
                    ${emp.admissao ?? null},
                    ${emp.local ?? null},
                    ${emp.situacao ?? null},
                    ${unit},
                    ${now},
                    ${now}
                )`
            );

            await prisma.$executeRaw`
                INSERT INTO funcionarios
                    (id, name, role, uen, matricula, admissao, local, situacao, unit, "createdAt", "updatedAt")
                VALUES
                    ${Prisma.join(rows)}
            `;
        }

        return NextResponse.json({ count: employees.length });
    } catch (error) {
        console.error("POST employees error:", error);
        return NextResponse.json({ error: "Erro ao importar funcionários" }, { status: 500 });
    }
}
