"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Users, Upload, Search, X, ChevronUp, ChevronDown, Pencil, Trash2, Check } from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";

interface Employee {
  name: string;        // COLABORADOR
  role?: string;       // CARGO
  uen?: string;        // UEN
  matricula?: string;  // MATRÍCULA
  admissao?: string;   // ADMISSÃO
  local?: string;      // LOCAL
  situacao?: string;   // SITUAÇÃO
}

const EMPLOYEES_KEY = "engelmig-employees";

function loadEmployees(): Employee[] {
  try {
    const s = localStorage.getItem(EMPLOYEES_KEY);
    if (s) return JSON.parse(s) as Employee[];
  } catch { /* ignore */ }
  return [];
}

function saveEmployees(data: Employee[]) {
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(data));
}

type SortKey = keyof Employee;
type SortDir = "asc" | "desc";

const SITUACAO_COLORS: Record<string, string> = {
  ativo:      "bg-green-100 text-green-700",
  afastado:   "bg-amber-100 text-amber-700",
  ferias:     "bg-blue-100 text-blue-700",
  desligado:  "bg-red-100 text-red-700",
  licenca:    "bg-purple-100 text-purple-700",
};

function SituacaoBadge({ situacao }: { situacao?: string }) {
  if (!situacao) return <span className="text-muted/50">—</span>;
  const key = Object.keys(SITUACAO_COLORS).find((k) =>
    situacao.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(k)
  );
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", key ? SITUACAO_COLORS[key] : "bg-gray-100 text-gray-600")}>
      {situacao}
    </span>
  );
}

const DATA_COLUMNS: { key: SortKey; label: string; mono?: boolean }[] = [
  { key: "uen",       label: "UEN"         },
  { key: "matricula", label: "Matrícula",   mono: true },
  { key: "admissao",  label: "Admissão"    },
  { key: "name",      label: "Colaborador" },
  { key: "role",      label: "Cargo"       },
  { key: "local",     label: "Local"       },
  { key: "situacao",  label: "Situação"    },
];

const PER_PAGE = 50;

const EMPTY_EDIT: Employee = { name: "", role: "", uen: "", matricula: "", admissao: "", local: "", situacao: "" };

export default function FuncionariosPage() {
  const { success, error } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);

  // Edição inline
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<Employee>(EMPTY_EDIT);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEmployees(loadEmployees());
  }, []);

  // ── Importação ────────────────────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

      if (raw.length < 2) { error("Planilha vazia ou sem dados"); return; }

      const norm = (s: string) =>
        String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const header = (raw[0] as string[]).map(norm);

      const find = (...terms: string[]) => {
        const idx = header.findIndex((h) => terms.some((t) => h.includes(t)));
        return idx >= 0 ? idx : null;
      };

      const colName      = find("colaborador", "nome", "name") ?? 0;
      const colRole      = find("cargo", "funcao");
      const colUen       = find("uen");
      const colMatricula = find("matricula", "registro", "chapa");
      const colAdmissao  = find("admiss");
      const colLocal     = find("local", "setor");
      const colSituacao  = find("situac");

      const getVal = (row: unknown[], col: number | null): string | undefined => {
        if (col === null) return undefined;
        const v = row[col];
        if (v === null || v === undefined || v === "") return undefined;
        if (v instanceof Date) return v.toLocaleDateString("pt-BR");
        return String(v).trim() || undefined;
      };

      const data: Employee[] = (raw.slice(1) as unknown[][])
        .map((row) => ({
          name:      String(row[colName] ?? "").trim(),
          role:      getVal(row, colRole),
          uen:       getVal(row, colUen),
          matricula: getVal(row, colMatricula),
          admissao:  getVal(row, colAdmissao),
          local:     getVal(row, colLocal),
          situacao:  getVal(row, colSituacao),
        }))
        .filter((e) => e.name);

      saveEmployees(data);
      setEmployees(data);
      setPage(1);
      setSearch("");
      setEditingEmp(null);
      success(`${data.length} colaborador${data.length !== 1 ? "es" : ""} importado${data.length !== 1 ? "s" : ""} — lista substituída`);
    } catch {
      error("Erro ao ler o arquivo Excel");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Excluir ───────────────────────────────────────────────────────────────
  const deleteEmployee = (emp: Employee) => {
    const updated = employees.filter((e) => e !== emp);
    saveEmployees(updated);
    setEmployees(updated);
    if (editingEmp === emp) setEditingEmp(null);
  };

  // ── Editar ────────────────────────────────────────────────────────────────
  const startEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setEditForm({ ...emp });
  };

  const cancelEdit = () => {
    setEditingEmp(null);
    setEditForm(EMPTY_EDIT);
  };

  const saveEdit = () => {
    if (!editForm.name.trim()) { error("Nome do colaborador é obrigatório"); return; }
    const clean: Employee = {
      name:      editForm.name.trim(),
      role:      editForm.role?.trim() || undefined,
      uen:       editForm.uen?.trim() || undefined,
      matricula: editForm.matricula?.trim() || undefined,
      admissao:  editForm.admissao?.trim() || undefined,
      local:     editForm.local?.trim() || undefined,
      situacao:  editForm.situacao?.trim() || undefined,
    };
    const updated = employees.map((e) => (e === editingEmp ? clean : e));
    saveEmployees(updated);
    setEmployees(updated);
    setEditingEmp(null);
    setEditForm(EMPTY_EDIT);
    success("Colaborador atualizado");
  };

  // ── Filtro / Ordenação ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = q
      ? employees.filter((e) =>
          [e.name, e.role, e.uen, e.matricula, e.local, e.situacao]
            .some((v) => v?.toLowerCase().includes(q))
        )
      : employees;

    return [...list].sort((a, b) => {
      const av = (a[sortKey] ?? "").toString().toLowerCase();
      const bv = (b[sortKey] ?? "").toString().toLowerCase();
      return sortDir === "asc"
        ? av.localeCompare(bv, "pt-BR")
        : bv.localeCompare(av, "pt-BR");
    });
  }, [employees, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortKey }) {
    if (sortKey !== field) return <ChevronUp size={11} className="opacity-20" />;
    return sortDir === "asc"
      ? <ChevronUp size={11} className="text-primary" />
      : <ChevronDown size={11} className="text-primary" />;
  }

  const cellInput = (field: keyof Employee, placeholder?: string) => (
    <input
      type="text"
      value={editForm[field] ?? ""}
      onChange={(e) => setEditForm((prev) => ({ ...prev, [field]: e.target.value }))}
      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
      placeholder={placeholder}
      className="w-full min-w-[80px] rounded border border-primary/40 bg-primary/5 px-2 py-1 text-xs outline-none focus:border-primary"
    />
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users size={28} className="text-accent" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Funcionários</h1>
            <p className="text-sm text-muted">
              {employees.length > 0
                ? `${employees.length} colaborador${employees.length !== 1 ? "es" : ""} cadastrado${employees.length !== 1 ? "s" : ""}`
                : "Importe a planilha de colaboradores"}
            </p>
          </div>
        </div>

        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          <Upload size={16} />
          {importing ? "Importando..." : "Importar Excel (.xlsx)"}
        </button>
      </div>

      {/* Barra de busca */}
      {employees.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar colaborador, cargo, UEN, local..."
              className="w-full rounded-lg border border-card-border bg-card-bg py-2 pl-8 pr-8 text-sm outline-none focus:border-primary"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {search && (
            <p className="text-sm text-muted">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-card-border py-28">
          <Users size={44} className="text-muted/20" />
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">Nenhum funcionário cadastrado</p>
            <p className="mt-1 text-sm text-muted">
              Clique em &quot;Importar Excel&quot; para carregar a planilha exportada do BI
            </p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            <Upload size={15} />
            Selecionar arquivo .xlsx
          </button>
        </div>
      ) : (
        <>
          {/* Tabela */}
          <div className="overflow-x-auto rounded-xl border border-card-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-card-bg">
                  {DATA_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-foreground"
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <SortIcon field={col.key} />
                      </div>
                    </th>
                  ))}
                  {/* Coluna de ações — sem ordenação */}
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((emp, i) => {
                  const isEditing = editingEmp === emp;
                  return (
                    <tr
                      key={`${emp.matricula ?? emp.name}-${i}`}
                      className={cn(
                        "border-b border-card-border/50 last:border-0 transition-colors",
                        isEditing ? "bg-primary/5" : "hover:bg-card-bg/60"
                      )}
                    >
                      {isEditing ? (
                        <>
                          <td className="px-3 py-2">{cellInput("uen", "UEN")}</td>
                          <td className="px-3 py-2">{cellInput("matricula", "Matrícula")}</td>
                          <td className="px-3 py-2">{cellInput("admissao", "dd/mm/aaaa")}</td>
                          <td className="px-3 py-2">{cellInput("name", "Nome *")}</td>
                          <td className="px-3 py-2">{cellInput("role", "Cargo")}</td>
                          <td className="px-3 py-2">{cellInput("local", "Local")}</td>
                          <td className="px-3 py-2">{cellInput("situacao", "Situação")}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={saveEdit}
                                title="Salvar"
                                className="rounded p-1.5 text-primary transition-colors hover:bg-primary/10"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                title="Cancelar"
                                className="rounded p-1.5 text-muted transition-colors hover:bg-card-bg"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm text-muted">
                            {emp.uen ?? <span className="text-muted/40">—</span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted">
                            {emp.matricula ?? <span className="not-italic text-muted/40">—</span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm text-muted">
                            {emp.admissao ?? <span className="text-muted/40">—</span>}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {emp.name}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-muted">
                            {emp.role ?? <span className="text-muted/40">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-muted">
                            {emp.local ?? <span className="text-muted/40">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <SituacaoBadge situacao={emp.situacao} />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startEdit(emp)}
                                title="Editar"
                                className="rounded p-1.5 text-muted transition-colors hover:bg-card-bg hover:text-primary"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => deleteEmployee(emp)}
                                title="Excluir"
                                className="rounded p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <p>
                Mostrando{" "}
                <span className="font-medium text-foreground">
                  {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)}
                </span>{" "}
                de{" "}
                <span className="font-medium text-foreground">{filtered.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-md border border-card-border px-3 py-1.5 text-xs transition-colors hover:bg-card-bg disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-3 text-xs">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-md border border-card-border px-3 py-1.5 text-xs transition-colors hover:bg-card-bg disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
