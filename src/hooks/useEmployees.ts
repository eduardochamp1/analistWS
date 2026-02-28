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
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);

    const alerts: EmpAlert[] = [];

    if (emp.asoExpiry) {
        const expiry = new Date(emp.asoExpiry + "T00:00:00");
        if (expiry < today) {
            alerts.push({ type: "error", msg: `ASO vencido em ${fmt(emp.asoExpiry)}` });
        } else if (expiry <= in30) {
            alerts.push({ type: "warning", msg: `ASO vence em ${fmt(emp.asoExpiry)}` });
        }
    }

    if (emp.vacationDeadline) {
        const deadline = new Date(emp.vacationDeadline + "T00:00:00");
        if (deadline < today) {
            alerts.push({ type: "error", msg: `Limite de férias vencido (${fmt(emp.vacationDeadline)})` });
        } else if (deadline <= in30) {
            alerts.push({ type: "warning", msg: `Férias devem ser tiradas até ${fmt(emp.vacationDeadline)}` });
        }
    }

    if (emp.vacationStart && emp.vacationEnd) {
        const start = new Date(emp.vacationStart + "T00:00:00");
        const end = new Date(emp.vacationEnd + "T00:00:00");
        if (start <= today && today <= end) {
            alerts.push({ type: "info", msg: `Em férias até ${fmt(emp.vacationEnd)}` });
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
