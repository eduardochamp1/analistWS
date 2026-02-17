"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, User, Settings, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function UserMenu() {
    const { data: session } = useSession();
    const [isOpen, setIsOpen] = useState(false);

    if (!session?.user) return null;

    return (
        <div className="relative">
            {/* User Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg transition-colors"
            >
                {/* Avatar */}
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {session.user.name?.charAt(0).toUpperCase() || session.user.email?.charAt(0).toUpperCase()}
                </div>

                {/* User Info */}
                <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-gray-900">
                        {session.user.name || "Usuário"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                        {session.user.email}
                    </p>
                </div>

                {/* Dropdown Icon */}
                <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""
                        }`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                        <div className="px-4 py-2 border-b border-gray-100">
                            <p className="text-xs text-gray-500">Conta</p>
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {session.user.email}
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                setIsOpen(false);
                                // TODO: Navigate to profile page
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                        >
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-700">Perfil</span>
                        </button>

                        <button
                            onClick={() => {
                                setIsOpen(false);
                                // TODO: Navigate to settings page
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                        >
                            <Settings className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-700">Configurações</span>
                        </button>

                        <div className="border-t border-gray-100 my-2" />

                        <button
                            onClick={() => {
                                signOut({ callbackUrl: "/login" });
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-left text-red-600"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="text-sm font-medium">Sair</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
