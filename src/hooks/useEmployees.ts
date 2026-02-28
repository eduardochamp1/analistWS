import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/contexts/ToastContext";

export interface Employee {
    id?: string;
    name: string;
    role?: string;
    uen?: string;
    matricula?: string;
    admissao?: string;
    local?: string;
    situacao?: string;
    // Compliance / scheduling fields
    asoExpiry?: string | null;        // YYYY-MM-DD — vencimento do ASO
    vacationDeadline?: string | null; // YYYY-MM-DD — data limite para tirar férias
    vacationStart?: string | null;    // YYYY-MM-DD — início das férias
    vacationEnd?: string | null;      // YYYY-MM-DD — fim das férias
}

export interface EmpAlert {
    type: "error" | "warning" | "info";
    msg: string;
}

function fmt(dateStr: string): string {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
}

/** Returns alerts for an employee based on ASO expiry, vacation deadline and vacation period. */
export function getEmpAlerts(emp: Employee): EmpAlert[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    /** Positive = days remaining, negative = days overdue, 0 = today */
    function diffDays(dateStr: string): number {
        const target = new Date(dateStr + "T00:00:00");
        return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
    }

    function plural(n: number): string {
        return Math.abs(n) === 1 ? "dia" : "dias";
    }

    const alerts: EmpAlert[] = [];

    // ── ASO ────────────────────────────────────────────────────────────────────
    if (emp.asoExpiry) {
        const days = diffDays(emp.asoExpiry);
        if (days < 0) {
            alerts.push({ type: "error", msg: `ASO vencido em ${fmt(emp.asoExpiry)}` });
        } else if (days <= 30) {
            alerts.push({ type: "warning", msg: `ASO próximo do vencimento — faltam ${days} ${plural(days)}` });
        }
    }

    // ── Férias ─────────────────────────────────────────────────────────────────
    const hasVacationPeriod = !!(emp.vacationStart && emp.vacationEnd);

    if (hasVacationPeriod) {
        // Período de férias informado — ignora alerta de data-limite e mostra status do período
        const daysToStart = diffDays(emp.vacationStart!);
        const daysToEnd   = diffDays(emp.vacationEnd!);

        if (daysToStart <= 0 && daysToEnd >= 0) {
            // Dentro do período de férias
            alerts.push({ type: "info", msg: `Colaborador de férias até ${fmt(emp.vacationEnd!)}` });
        } else if (daysToStart > 0) {
            // Férias ainda não começaram
            alerts.push({ type: "info", msg: `Período de férias próximo — em ${daysToStart} ${plural(daysToStart)}` });
        }
        // Férias já encerradas → sem alerta (período já passou)
    } else if (emp.vacationDeadline) {
        // Sem período informado — alerta pela data-limite
        const days = diffDays(emp.vacationDeadline);
        if (days < 0) {
            alerts.push({ type: "error", msg: `Colaborador ultrapassou o limite de férias` });
        } else if (days <= 60) {
            alerts.push({ type: "warning", msg: `Férias vencem nos próximos ${days} ${plural(days)}` });
        }
    }

    return alerts;
}

/** Returns the highest severity color class for a chip indicator. */
export function alertSeverityColor(alerts: EmpAlert[]): string | null {
    if (alerts.some((a) => a.type === "error")) return "bg-red-500";
    if (alerts.some((a) => a.type === "warning")) return "bg-amber-400";
    if (alerts.some((a) => a.type === "info")) return "bg-blue-400";
    return null;
}

export function useEmployees(unit: "CCM" | "STC" = "CCM") {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const { success, error } = useToast();

    const fetchEmployees = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/employees?unit=${unit}`);
            if (res.ok) {
                const data = await res.json();
                setEmployees(data);
            }
        } catch {
            // silently fail — list stays empty
        } finally {
            setLoading(false);
        }
    }, [unit]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    // Replaces all employees for this unit with the given list
    const importEmployees = useCallback(async (data: Employee[]): Promise<number> => {
        const res = await fetch("/api/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employees: data, unit }),
        });
        if (!res.ok) {
            error("Erro ao importar funcionários");
            throw new Error("Import failed");
        }
        const result = await res.json();
        await fetchEmployees(); // Reload to get server-assigned IDs
        success(
            `${result.count} colaborador${result.count !== 1 ? "es" : ""} importado${result.count !== 1 ? "s" : ""} — lista substituída`
        );
        return result.count;
    }, [unit, fetchEmployees, success, error]);

    // Deletes a single employee by id
    const deleteEmployee = useCallback(async (emp: Employee) => {
        if (!emp.id) return;
        const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
        if (!res.ok) {
            error("Erro ao excluir funcionário");
            return;
        }
        setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    }, [error]);

    // Updates compliance/scheduling fields for a single employee
    const updateEmployee = useCallback(async (
        emp: Employee,
        fields: Partial<Pick<Employee, "asoExpiry" | "vacationDeadline" | "vacationStart" | "vacationEnd">>
    ) => {
        if (!emp.id) return;
        const res = await fetch(`/api/employees/${emp.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
        });
        if (!res.ok) {
            error("Erro ao salvar dados do colaborador");
            return;
        }
        setEmployees((prev) =>
            prev.map((e) => (e.id === emp.id ? { ...e, ...fields } : e))
        );
        success("Dados salvos");
    }, [error, success]);

    return { employees, loading, fetchEmployees, importEmployees, deleteEmployee, updateEmployee };
}
