import React from 'react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/time';
import { Hash, Activity } from 'lucide-react';

interface ChatMessageListItemProps {
    id: string;
    shortId: string;
    sourceCollection: string;
    unreadCount: number;
    lastUpdated: any; // Firestore Timestamp or Date
    projectName?: string;
    client?: string;
    company_name?: string;
    status: string;
    messages?: any[]; // Array of message objects
    isActive: boolean;
    isPinned: boolean;
    category: {
        id: string;
        label: string;
        icon: React.ElementType;
        color: string;
        bg: string;
    } | undefined;
    onSelect: (id: string, coll: string) => void;
    onTogglePin: (e: React.MouseEvent, id: string) => void;
    userId: string;
}

const getStatusInfo = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s.includes("PENDING") || s.includes("REVIEW")) return { label: "PENDING", color: "bg-amber-500", bg: "bg-amber-50" };
    if (s.includes("APPROVED") || s.includes("CONFIRMED") || s.includes("CONFIRM")) return { label: "APPROVED", color: "bg-emerald-500", bg: "bg-emerald-50" };
    if (s.includes("COMPLETED") || s.includes("DONE") || s.includes("FINISHED")) return { label: "DONE", color: "bg-blue-500", bg: "bg-blue-50" };
    if (s.includes("CANCEL") || s.includes("REJECT")) return { label: "CANCELLED", color: "bg-rose-500", bg: "bg-rose-50" };
    if (s.includes("PROGRESS") || s.includes("PROCESS")) return { label: "IN PROGRESS", color: "bg-indigo-500", bg: "bg-indigo-50" };
    return { label: s || "ACTIVE", color: "bg-slate-400", bg: "bg-slate-50" };
};

const ChatMessageListItem: React.FC<ChatMessageListItemProps> = ({
    id,
    shortId,
    sourceCollection,
    unreadCount,
    lastUpdated,
    projectName,
    client,
    company_name,
    status,
    messages = [],
    isActive,
    isPinned,
    category,
    onSelect,
    onTogglePin,
    userId
}) => {
    const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : null;
    const statusInfo = getStatusInfo(status);

    return (
        <button
            key={id}
            onClick={() => onSelect(id, sourceCollection)}
            className={cn(
                "w-full px-3 py-2.5 flex items-center gap-3 transition-all relative group border-b border-slate-50",
                isActive
                    ? "bg-blue-50 border-l-4 border-l-blue-600 text-slate-900"
                    : "bg-white hover:bg-slate-50 text-slate-900 border-l-4 border-l-transparent"
            )}
        >
            {/* Avatar */}
            <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                isActive ? "bg-blue-600 text-white" : `${category?.bg || 'bg-slate-100'} ${category?.color || 'text-slate-500'}`
            )}>
                {category ? <category.icon size={18} strokeWidth={2} /> : <Hash size={18} />}
            </div>

            <div className="flex-1 min-w-0 text-left overflow-hidden">
                {/* Top row: Name + Time */}
                <div className="flex justify-between items-center mb-0.5">
                    <h4 className="text-[13px] font-semibold truncate text-slate-900">
                        {projectName || client || company_name || "Untitled Project"}
                    </h4>
                    <span className={cn("text-[10px] font-medium shrink-0 ml-2", isActive ? "text-blue-600" : "text-slate-400")}>
                        {formatRelativeTime(lastUpdated)}
                    </span>
                </div>

                {/* Middle row: Status + ID + Unread */}
                <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded", statusInfo.bg, statusInfo.color.replace('bg-', 'text-'))}>
                        {statusInfo.label}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                        #{shortId}
                    </span>
                    {isPinned && (
                        <Activity size={10} className="text-amber-500 fill-amber-500" />
                    )}
                    {unreadCount > 0 && !isActive && (
                        <span className="ml-auto text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>

                {/* Bottom row: Last message preview */}
                <p className={cn(
                    "text-[12px] truncate leading-tight",
                    isActive ? "text-slate-700" : "text-slate-500"
                )}>
                    {lastMsg ? (
                        <>
                            <span className="font-medium">{lastMsg.senderName?.split(' ')[0]}:</span> {lastMsg.text}
                        </>
                    ) : (
                        <span className="italic opacity-50">No messages yet</span>
                    )}
                </p>
            </div>
        </button>
    );
};

export default ChatMessageListItem;
