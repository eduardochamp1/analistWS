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
            <main className="main-content flex min-h-screen flex-1 w-full min-w-0 flex-col">
                {/* pt-16 compensa botão hamburger no mobile; md:pt-8 no desktop */}
                <div className="flex-1 p-6 pt-16 md:pt-8">
                    {children}
                </div>

                {/* Footer */}
                <footer className="border-t border-card-border/50 px-6 py-3">
                    <p className="text-center text-[11px] text-muted/50 select-none">
                        Copyright &copy; {new Date().getFullYear()} AnalistWS.{" "}
                        Built by{" "}
                        <span className="font-medium text-muted/70">José Eduardo Vilela Zouain</span>.
                    </p>
                </footer>
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
