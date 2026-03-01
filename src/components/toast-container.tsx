"use client";

import { useToast } from "@/contexts/ToastContext";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const toastConfig = {
    success: {
        icon: CheckCircle2,
        bgColor: "bg-green-50",
        borderColor: "border-green-500",
        textColor: "text-green-800",
        iconColor: "text-green-600",
    },
    error: {
        icon: XCircle,
        bgColor: "bg-red-50",
        borderColor: "border-red-500",
        textColor: "text-red-800",
        iconColor: "text-red-600",
    },
    warning: {
        icon: AlertTriangle,
        bgColor: "bg-amber-50",
        borderColor: "border-amber-500",
        textColor: "text-amber-800",
        iconColor: "text-amber-600",
    },
    info: {
        icon: Info,
        bgColor: "bg-blue-50",
        borderColor: "border-blue-500",
        textColor: "text-blue-800",
        iconColor: "text-blue-600",
    },
};

export function ToastContainer() {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => {
                const config = toastConfig[toast.type];
                const Icon = config.icon;

                return (
                    <div
                        key={toast.id}
                        style={{ animation: "toast-in 0.3s ease-out" }}
                        className={cn(
                            "pointer-events-auto flex items-start gap-3 rounded-lg border-l-4 p-4 shadow-lg",
                            "min-w-[300px] max-w-md",
                            config.bgColor,
                            config.borderColor
                        )}
                        role="alert"
                    >
                        <Icon size={20} className={cn("shrink-0 mt-0.5", config.iconColor)} />
                        <p className={cn("flex-1 text-sm font-medium", config.textColor)}>
                            {toast.message}
                        </p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className={cn(
                                "shrink-0 rounded-md p-1 transition-colors",
                                "hover:bg-black/10",
                                config.textColor
                            )}
                            aria-label="Fechar notificação"
                        >
                            <X size={16} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
