import { useState } from "react"
import { Bell, Check, X } from "lucide-react"

interface NotificationItem {
    id: string
    type: "warning" | "info" | "success"
    message: string
    time: string
    read: boolean
}

interface NotificationsDropdownProps {
    notifications: NotificationItem[]
    onMarkRead?: (id: string) => void
    onMarkAllRead?: () => void
}

export function NotificationsDropdown({
    notifications,
    onMarkRead,
    onMarkAllRead,
}: NotificationsDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const unreadCount = notifications.filter((n) => !n.read).length

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in slide-in-from-top-2">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-white">Notifications</h3>
                            {onMarkAllRead && unreadCount > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onMarkAllRead()
                                    }}
                                    className="text-xs text-brand-blue hover:underline font-medium"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>

                        <div className="max-h-80 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No notifications</p>
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!notification.read ? "bg-brand-blue/5" : ""
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div
                                                className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notification.type === "warning"
                                                        ? "bg-amber-500"
                                                        : notification.type === "success"
                                                            ? "bg-green-500"
                                                            : "bg-blue-500"
                                                    }`}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-slate-800 dark:text-slate-200">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                    {notification.time}
                                                </p>
                                            </div>
                                            {!notification.read && onMarkRead && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onMarkRead(notification.id)
                                                    }}
                                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                                                    title="Mark as read"
                                                >
                                                    <Check className="w-4 h-4 text-green-500" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
