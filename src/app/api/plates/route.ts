/**
 * GET /api/plates
 *
 * Busca a planilha FROTA.xlsx no SharePoint (URL armazenada apenas em variáveis
 * de ambiente — nunca exposta ao browser) e retorna a lista de placas da coluna
 * "PLACA".
 *
 * Fluxo de autenticação SharePoint (link de compartilhamento):
 *  1. Requisição à URL de sharing → 302 + cookie FedAuth
 *  2. Requisição ao redirect com o cookie → stream do .xlsx
 */

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

const SHARING_URL = process.env.PLATES_SHAREPOINT_URL ?? "";

export async function GET() {
  if (!SHARING_URL) {
    return NextResponse.json(
      { error: "PLATES_SHAREPOINT_URL não configurada no servidor." },
      { status: 500 },
    );
  }

  try {
    // ── Passo 1: obter cookie FedAuth e URL de redirect ─────────────────────
    const step1 = await fetch(`${SHARING_URL}&download=1`, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (step1.status !== 302) {
      return NextResponse.json(
        { error: `SharePoint retornou status inesperado: ${step1.status}` },
        { status: 502 },
      );
    }

    const fedAuthCookie = step1.headers
      .getSetCookie()
      .find((c) => c.startsWith("FedAuth="))
      ?.split(";")[0]; // apenas o par nome=valor

    const location = step1.headers.get("location");

    if (!fedAuthCookie || !location) {
      return NextResponse.json(
        { error: "Falha ao obter cookie de autenticação do SharePoint." },
        { status: 502 },
      );
    }

    // Location pode ser relativa (/personal/...) ou absoluta
    const fileUrl = location.startsWith("http")
      ? location
      : `https://engelmigproject-my.sharepoint.com${location}`;

    // ── Passo 2: baixar o arquivo usando o cookie ────────────────────────────
    const step2 = await fetch(fileUrl, {
      headers: {
        Cookie: fedAuthCookie,
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!step2.ok) {
      return NextResponse.json(
        { error: `Falha ao baixar planilha: ${step2.status}` },
        { status: 502 },
      );
    }

    const buffer = await step2.arrayBuffer();

    // ── Passo 3: parsear o XLSX e extrair a coluna PLACA ─────────────────────
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: "",
    });

    if (rows.length === 0) {
      return NextResponse.json({ plates: [] });
    }

    // Localiza a coluna de placa (aceita variações de nome)
    const norm = (s: string) =>
      String(s)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const firstRow = rows[0];
    const plateCol = Object.keys(firstRow).find((k) =>
      ["placa", "plate", "veiculo", "vei", "carro"].some((t) =>
        norm(k).includes(t),
      ),
    );

    if (!plateCol) {
      return NextResponse.json(
        {
          error:
            "Coluna de placa não encontrada na planilha. Use um cabeçalho como 'PLACA'.",
        },
        { status: 422 },
      );
    }

    const plates = rows
      .map((r) => String(r[plateCol] ?? "").trim().toUpperCase())
      .filter(Boolean);

    return NextResponse.json({ plates, total: plates.length });
  } catch (err) {
    console.error("[/api/plates]", err);
    return NextResponse.json(
      { error: "Erro interno ao buscar planilha de frota." },
      { status: 500 },
    );
  }
}
