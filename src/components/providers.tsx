"use client";

import { ToastProvider } from "@/contexts/ToastContext";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { ToastContainer } from "@/components/toast-container";
import { Sidebar } from "@/components/sidebar";

function Layout({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar();

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar />
            {/* Padding-left acompanha a largura da sidebar com transição suave */}
            <main
                className="flex-1 w-full min-w-0 transition-all duration-300"
                style={{ paddingLeft: collapsed ? 64 : 256 }}
            >
                {/* Compensa header mobile (pt-16) e desktop (pt-8) */}
                <div className="p-6 pt-16 md:pt-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <ToastProvider>
                <Layout>{children}</Layout>
                <ToastContainer />
            </ToastProvider>
        </SidebarProvider>
    );
}
