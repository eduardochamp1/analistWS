"use client";

import { ToastProvider } from "@/contexts/ToastContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { DarkModeProvider } from "@/contexts/DarkModeContext";
import { ToastContainer } from "@/components/toast-container";
import { Sidebar } from "@/components/sidebar";

function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />
            {/*
              main-content: padding-left=0 no mobile (sidebar desliza por cima),
              padding-left=var(--sidebar-w) no md+ (controlado pelo CSS var no :root).
              Veja globals.css — .main-content + @media md.
            */}
            <main className="main-content flex-1 w-full min-w-0">
                {/* pt-16 compensa botão hamburger no mobile; md:pt-8 no desktop */}
                <div className="p-6 pt-16 md:pt-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <DarkModeProvider>
            <SidebarProvider>
                <ToastProvider>
                    <Layout>{children}</Layout>
                    <ToastContainer />
                </ToastProvider>
            </SidebarProvider>
        </DarkModeProvider>
    );
}
