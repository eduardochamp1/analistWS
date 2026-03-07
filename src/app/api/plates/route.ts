/**
 * GET /api/plates
 *
 * Busca a planilha FROTA.xlsx no SharePoint (URL armazenada apenas em variáveis
 * de ambiente — nunca exposta ao browser), extrai placas agrupadas por UEN e
 * retorna somente as UENs autorizadas.
 *
 * Estrutura da planilha FROTA.xlsx:
 *   Coluna D (SETOR)  → COP 6 dígitos, ex: "010604 - ES LEITURA CENTRO CARIACICA"
 *                        LEFT(4) = código UEN, ex: "0106"
 *   Coluna G (COP)    → Placa do veículo, ex: "TOP-0B64"
 *   Coluna W (sem nome fixo) → "0106 - ES LEITURA CENTRO" → nome da UEN
 *
 * Fluxo de autenticação SharePoint (link de compartilhamento):
 *   1. Requisição à URL de sharing → 302 + cookie FedAuth
 *   2. Requisição ao redirect com o cookie → stream do .xlsx
 */

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

// ── UENs autorizadas (fixo por regra de negócio) ─────────────────────────────
const ALLOWED_UENS = new Set([
  "0106", "0107", "0109", "0111", "0112",
  "0120", "0121", "0123", "0124", "0136",
]);

// Formato de placa brasileiro (antigo AAA-1234 ou Mercosul AAA-1A23)
const PLATE_REGEX = /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/i;

const SHARING_URL = process.env.PLATES_SHAREPOINT_URL ?? "";

export interface PlatesResponse {
  byUen: Record<string, string[]>;   // UEN → placas únicas ordenadas
  uenNames: Record<string, string>;  // UEN → nome completo
  uens: string[];                    // UENs com dados, ordenadas
  totalPlates: number;
}

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
      ?.split(";")[0];

    const location = step1.headers.get("location");

    if (!fedAuthCookie || !location) {
      return NextResponse.json(
        { error: "Falha ao obter cookie de autenticação do SharePoint." },
        { status: 502 },
      );
    }

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

    // ── Passo 3: parsear o XLSX ──────────────────────────────────────────────
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // Lê como arrays para acessar por índice de coluna
    // A=0, B=1, C=2, D=3(SETOR), E=4, F=5, G=6(COP/PLACA), W=22(nome UEN)
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
    });

    if (rawRows.length < 2) {
      return NextResponse.json({ byUen: {}, uenNames: {}, uens: [], totalPlates: 0 });
    }

    // Encontra os índices das colunas pelos cabeçalhos da linha 1
    const headers = (rawRows[0] as unknown[]).map((h) => String(h ?? ""));
    const setorIdx = headers.indexOf("SETOR");  // coluna D = 3
    const copIdx   = headers.indexOf("COP");    // coluna G = 6
    // Coluna W (índice 22) não tem cabeçalho confiável → usar índice fixo
    const uenNameIdx = 22;

    if (setorIdx === -1 || copIdx === -1) {
      return NextResponse.json(
        { error: "Colunas SETOR ou COP não encontradas na planilha." },
        { status: 422 },
      );
    }

    // ── Passo 4: agrupar placas por UEN ─────────────────────────────────────
    const byUen: Record<string, Set<string>> = {};
    const uenNames: Record<string, string>   = {};

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i] as unknown[];

      const setorRaw = String(row[setorIdx] ?? "").trim();
      const uen      = setorRaw.substring(0, 4);

      if (!ALLOWED_UENS.has(uen)) continue;

      const plate = String(row[copIdx] ?? "").trim().toUpperCase();
      if (!PLATE_REGEX.test(plate)) continue;

      if (!byUen[uen]) byUen[uen] = new Set();
      byUen[uen].add(plate);

      // Nome da UEN a partir da coluna W (ex: "0106 - ES LEITURA CENTRO")
      if (!uenNames[uen]) {
        const nameRaw = String(row[uenNameIdx] ?? "").trim();
        if (nameRaw.includes(" - ")) {
          uenNames[uen] = nameRaw.split(" - ").slice(1).join(" - ");
        }
      }
    }

    // ── Passo 5: serializar e retornar ──────────────────────────────────────
    const result: PlatesResponse = {
      byUen:      Object.fromEntries(
        Object.entries(byUen).map(([k, v]) => [k, [...v].sort()]),
      ),
      uenNames,
      uens: Object.keys(byUen).sort(),
      totalPlates: Object.values(byUen).reduce((s, v) => s + v.size, 0),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/plates]", err);
    return NextResponse.json(
      { error: "Erro interno ao buscar planilha de frota." },
      { status: 500 },
    );
  }
}
