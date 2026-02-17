"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/contexts/ToastContext";
import { ToastContainer } from "@/components/toast-container";
import { Sidebar } from "@/components/sidebar";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ToastProvider>
                <div className="flex min-h-screen bg-gray-50">
                    <Sidebar />
                    {/* Main content com padding para compensar sidebar em desktop */}
                    <main className="flex-1 w-full min-w-0 md:pl-64">
                        <div className="p-6 pt-16 md:pt-8">
                            {children}
                        </div>
                    </main>
                </div>
                <ToastContainer />
            </ToastProvider>
        </SessionProvider>
    );
}
