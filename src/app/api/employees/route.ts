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

// POST — replaces OR merges employees for the given unit
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { employees, unit = "CCM", merge = false } = body as {
            employees: EmployeeInput[];
            unit?: string;
            merge?: boolean;
        };

        if (!Array.isArray(employees)) {
            return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
        }

        const now = new Date();

        // ── Merge mode: upsert by matricula → name, never delete existing ──────
        if (merge) {
            const existing = await prisma.$queryRaw<{ id: string; matricula: string | null; name: string }[]>`
                SELECT id, matricula, name FROM funcionarios WHERE unit = ${unit}
            `;
            const norm = (s: string) => s.toLowerCase().trim();
            const byMatricula = new Map(
                existing.filter((e) => e.matricula).map((e) => [e.matricula!.trim(), e.id])
            );
            const byName = new Map(existing.map((e) => [norm(e.name), e.id]));

            let added = 0, updated = 0;
            for (const emp of employees) {
                const matchId =
                    (emp.matricula?.trim() && byMatricula.get(emp.matricula.trim())) ||
                    byName.get(norm(emp.name));

                if (matchId) {
                    await prisma.$executeRaw`
                        UPDATE funcionarios
                        SET name      = ${emp.name},
                            role      = ${emp.role      ?? null},
                            uen       = ${emp.uen       ?? null},
                            matricula = ${emp.matricula ?? null},
                            admissao  = ${emp.admissao  ?? null},
                            local     = ${emp.local     ?? null},
                            situacao  = ${emp.situacao  ?? null},
                            "updatedAt" = ${now}
                        WHERE id = ${matchId}
                    `;
                    updated++;
                } else {
                    const newId = randomUUID();
                    await prisma.$executeRaw`
                        INSERT INTO funcionarios
                            (id, name, role, uen, matricula, admissao, local, situacao, unit, "createdAt", "updatedAt")
                        VALUES (
                            ${newId}, ${emp.name}, ${emp.role ?? null}, ${emp.uen ?? null},
                            ${emp.matricula ?? null}, ${emp.admissao ?? null}, ${emp.local ?? null},
                            ${emp.situacao ?? null}, ${unit}, ${now}, ${now}
                        )
                    `;
                    added++;
                    byName.set(norm(emp.name), newId); // prevent duplicates in same import
                }
            }
            return NextResponse.json({ count: employees.length, added, updated, mode: "merge" });
        }

        // ── Replace mode (default): delete existing then bulk-insert ─────────
        await prisma.$executeRaw`DELETE FROM funcionarios WHERE unit = ${unit}`;

        if (employees.length > 0) {
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

        return NextResponse.json({ count: employees.length, mode: "replace" });
    } catch (error) {
        console.error("POST employees error:", error);
        return NextResponse.json({ error: "Erro ao importar funcionários" }, { status: 500 });
    }
}

// PUT — create a single employee (no bulk delete)
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { employee, unit = "CCM" } = body as { employee: EmployeeInput; unit?: string };

        if (!employee?.name?.trim()) {
            return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
        }

        const id  = randomUUID();
        const now = new Date();

        await prisma.$executeRaw`
            INSERT INTO funcionarios
                (id, name, role, uen, matricula, admissao, local, situacao, unit, "createdAt", "updatedAt")
            VALUES (
                ${id},
                ${employee.name.trim()},
                ${employee.role  ?? null},
                ${employee.uen   ?? null},
                ${employee.matricula ?? null},
                ${employee.admissao  ?? null},
                ${employee.local     ?? null},
                ${employee.situacao  ?? null},
                ${unit},
                ${now},
                ${now}
            )
        `;

        return NextResponse.json({ id });
    } catch (error) {
        console.error("PUT employee error:", error);
        return NextResponse.json({ error: "Erro ao criar funcionário" }, { status: 500 });
    }
}
