import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, status, severity, description, selectedTeamId, resolvedByTeamId, resolvedAt } = body;

        const updated = await prisma.emergency.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(status !== undefined && { status }),
                ...(severity !== undefined && { severity }),
                ...(description !== undefined && { description }),
                ...(selectedTeamId !== undefined && { selectedTeamId }),
                ...(resolvedByTeamId !== undefined && { resolvedByTeamId }),
                ...(resolvedAt !== undefined && { resolvedAt: resolvedAt ? new Date(resolvedAt) : null }),
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PATCH emergency error:", error);
        return NextResponse.json(
            { error: "Erro ao atualizar emergência" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.emergency.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE emergency error:", error);
        return NextResponse.json(
            { error: "Erro ao deletar emergência" },
            { status: 500 }
        );
    }
}
