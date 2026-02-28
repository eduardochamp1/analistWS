import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;
        await prisma.$executeRaw`DELETE FROM funcionarios WHERE id = ${id}`;
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("DELETE employee error:", error);
        return NextResponse.json({ error: "Erro ao excluir funcionário" }, { status: 500 });
    }
}

// PATCH — update individual employee fields (asoExpiry, vacationDeadline, vacationStart, vacationEnd)
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;
        const body = await request.json() as {
            asoExpiry?: string | null;
            vacationDeadline?: string | null;
            vacationStart?: string | null;
            vacationEnd?: string | null;
        };

        const now = new Date();

        // Build SET clauses dynamically only for provided fields
        const setClauses: string[] = [];
        const values: unknown[] = [];
        let idx = 1;

        if ("asoExpiry" in body) {
            setClauses.push(`"asoExpiry" = $${idx++}`);
            values.push(body.asoExpiry ?? null);
        }
        if ("vacationDeadline" in body) {
            setClauses.push(`"vacationDeadline" = $${idx++}`);
            values.push(body.vacationDeadline ?? null);
        }
        if ("vacationStart" in body) {
            setClauses.push(`"vacationStart" = $${idx++}`);
            values.push(body.vacationStart ?? null);
        }
        if ("vacationEnd" in body) {
            setClauses.push(`"vacationEnd" = $${idx++}`);
            values.push(body.vacationEnd ?? null);
        }

        if (setClauses.length === 0) {
            return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
        }

        setClauses.push(`"updatedAt" = $${idx++}`);
        values.push(now);
        values.push(id); // for WHERE clause

        const sql = `UPDATE funcionarios SET ${setClauses.join(", ")} WHERE id = $${idx}`;
        await prisma.$executeRawUnsafe(sql, ...values);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("PATCH employee error:", error);
        return NextResponse.json({ error: "Erro ao atualizar funcionário" }, { status: 500 });
    }
}
