"use client"

import * as React from "react"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import ProtectedPageWrapper from "../../components/protected-page-wrapper";

import {
    CalendarCheck, FileText, Monitor, ThumbsUp,
    ClipboardCheck, MoreHorizontal, Bell,
    Plus, Activity, CloudSun, CloudRain, Sun, CloudLightning, Cloud, Moon, CloudMoon,
    ArrowUpRight, Clock, CheckCircle2, AlertTriangle, Layers, MessageSquare, ChevronRight,
    Search, X, Settings, LogOut, User, Menu
} from "lucide-react";

import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, limit, orderBy, doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { isAfter } from "date-fns";

export default function EngiconnectDashboard() {
    const router = useRouter()
    const [userId, setUserId] = useState<string | null>(null)
    const [userRole, setUserRole] = useState<string | null>(null) 
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [weather, setWeather] = useState({ temp: "--", condition: "Syncing...", code: 0 });

    const [currentPage, setCurrentPage] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    const [activeTab, setActiveTab] = useState("Monitoring");

    const [userDetails, setUserDetails] = useState({
        Firstname: "",
        Position: "",
        profilePicture: ""
    })

    const [notifications, setNotifications] = useState({
        siteVisit: 0,
        jobRequest: 0,
        shopDrawing: 0,
        testingActive: 0,
        testingOverdue: 0,
        otherRequest: 0,
        dialuxRequest: 0,
        dialuxInProgress: 0,
        dialuxCompleted: 0,
        unreadMessages: 0,
        unreadByService: {
            dialux: 0,
            jobRequest: 0,
            siteVisit: 0,
            shopDrawing: 0
        }
    })

    // --- TABS LOGIC ---
    const baseTabs = ["Monitoring", "Projects", "Requests"];
    const tabs = [...baseTabs];
    if (userRole === "SUPER_ADMIN") {
        tabs.push("Super Admin");
    } else if (userRole === "MANAGER" || userRole === "ADMIN") {
        tabs.push("Admin");
    }

    const StreetLightIcon = ({ size = 24, className = "" }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M7 22h3M9 22V7c0-2 1-3 3-3h5" /><path d="M15 4h5l1 2h-7l1-2z" /><path d="M17 9v1M14 8l-.5.5M20 8l.5.5" opacity="0.5" />
        </svg>
    );

    // --- RBAC: SERVICES FILTERING ---
    const allServices = [
        { label: "Site Visit Appointment", icon: CalendarCheck, count: notifications.siteVisit, msgCount: notifications.unreadByService.siteVisit, path: "/appointments/site-visit", roles: ["SUPER_ADMIN", "MANAGER", "ENGINEERING"] },
        { label: "Job Request", icon: FileText, count: notifications.jobRequest, msgCount: notifications.unreadByService.jobRequest, path: "/request/job", roles: ["SUPER_ADMIN", "MANAGER", "MEMBER", "ENGINEERING"] },
        { label: "Dialux Simulation", icon: Monitor, count: notifications.dialuxRequest, msgCount: notifications.unreadByService.dialux, path: "/request/dialux", roles: ["SUPER_ADMIN", "MANAGER", "ENGINEERING"] },
        { label: "Product Recommendation", icon: ThumbsUp, count: 0, msgCount: 0, path: "/requests/recommendation", roles: ["SUPER_ADMIN", "MANAGER", "MEMBER", "ENGINEERING"] },
        { label: "SPF Shop Drawing Request", icon: StreetLightIcon, count: notifications.shopDrawing, msgCount: notifications.unreadByService.shopDrawing, path: "/request/shop-drawing", roles: ["SUPER_ADMIN", "MANAGER", "ENGINEERING"] },
        { label: "Testing Monitoring", icon: ClipboardCheck, count: notifications.testingActive + notifications.testingOverdue, msgCount: 0, path: "/request/testing", roles: ["SUPER_ADMIN", "MANAGER", "ENGINEERING"] },
        { label: "Other Request", icon: MoreHorizontal, count: notifications.otherRequest, msgCount: 0, path: "/request/other", roles: ["SUPER_ADMIN", "MANAGER", "MEMBER", "ENGINEERING"] },
    ];

    const services = allServices.filter(service => service.roles.includes(userRole || ""));
    const itemsPerPage = 6; 
    const totalPages = Math.ceil(services.length / itemsPerPage);

    // --- SYNC LOGIC: MONGO (Details) + FIRESTORE (Role) ---
    useEffect(() => {
        const storedUserId = localStorage.getItem("userId")
        setUserId(storedUserId)

        const fetchPersonnelRecord = async () => {
            if (!storedUserId) { setIsLoading(false); return; }
            try {
                // 1. Get Details from MongoDB API
                const res = await fetch(`/api/user?id=${encodeURIComponent(storedUserId)}`)
                const mongoData = await res.json()
                
                setUserDetails({ 
                    Firstname: mongoData.Firstname || "User", 
                    Position: mongoData.Position || "Member", 
                    profilePicture: mongoData.profilePicture || "" 
                })

                // 2. Get Role from Firestore (The correct source)
                const userDocRef = doc(db, "users", storedUserId);
                const userDocSnap = await getDoc(userDocRef);

                let syncedRole = mongoData.Role; // Fallback

                if (userDocSnap.exists()) {
                    const firestoreData = userDocSnap.data();
                    syncedRole = firestoreData.role || firestoreData.Role || mongoData.Role;
                }

                setUserRole(syncedRole);
                localStorage.setItem("userRole", syncedRole);

            } catch (error) { 
                console.error("Sync Error:", error);
                setUserRole(localStorage.getItem("userRole"));
            } finally { 
                setIsLoading(false); 
            }
        }
        fetchPersonnelRecord()
    }, [])

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const fetchWeather = async (lat: number, lon: number) => {
            try {
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                const data = await response.json();
                const code = data.current_weather.weathercode;
                let status = "Clear";
                if (code > 0 && code < 4) status = "Cloudy";
                if (code >= 51 && code <= 67) status = "Rainy";
                if (code >= 95) status = "Stormy";
                setWeather({ temp: `${Math.round(data.current_weather.temperature)}°`, condition: status, code: code });
            } catch (error) { setWeather({ temp: "!!", condition: "Error", code: 0 }); }
        };
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude));
        }
    }, []);

    const getWeatherIcon = (condition: string, size: number) => {
        const hour = currentTime.getHours();
        const isNight = hour >= 18 || hour < 6;
        switch (condition) {
            case "Rainy": return <CloudRain size={size} className="text-blue-500" />;
            case "Stormy": return <CloudLightning size={size} className="text-purple-500" />;
            case "Cloudy": return isNight ? <CloudMoon size={size} className="text-indigo-300" /> : <Cloud size={size} className="text-gray-400" />;
            case "Clear": return isNight ? <Moon size={size} className="text-yellow-200" /> : <Sun size={size} className="text-yellow-500" />;
            default: return isNight ? <CloudMoon size={size} className="text-indigo-200" /> : <CloudSun size={size} className="text-orange-500" />;
        }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours()
        if (hour < 12) return "Good Morning"
        if (hour < 18) return "Good Afternoon"
        return "Good Evening"
    }

    const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const formattedDate = currentTime.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })

    // --- REALTIME NOTIFICATIONS ---
    useEffect(() => {
        if (!db || !userId) return;
        const unsubSite = onSnapshot(query(collection(db, "appointments"), where("status", "==", "PENDING")), (snap) => setNotifications(prev => ({ ...prev, siteVisit: snap.size })));
        const unsubShop = onSnapshot(query(collection(db, "shop_drawing_requests"), where("department", "==", "ENGINEERING"), where("status", "==", "PENDING_REVIEW")), (snap) => setNotifications(prev => ({ ...prev, shopDrawing: snap.size })));
        const unsubJob = onSnapshot(query(collection(db, "job_requests"), where("status", "==", "PENDING")), (snap) => setNotifications(prev => ({ ...prev, jobRequest: snap.size })));
        const unsubOther = onSnapshot(query(collection(db, "other_requests"), where("status", "==", "PENDING")), (snap) => setNotifications(prev => ({ ...prev, otherRequest: snap.size })));
        const unsubDialux = onSnapshot(query(collection(db, "dialux_requests"), where("status", "==", "PENDING")), (snap) => setNotifications(prev => ({ ...prev, dialuxRequest: snap.size })));
        
        const unsubTesting = onSnapshot(query(collection(db, "testing_tracker"), where("arrivalDate", "!=", null), limit(200)), (snap) => {
            let active = 0; let overdue = 0;
            const today = new Date();
            snap.docs.forEach(doc => {
                const d = doc.data();
                if (!d.releaseDate) {
                    const target = d.targetDate?.toDate();
                    if (target && isAfter(today, target)) overdue++;
                    else if (d.arrivalDate) active++;
                }
            });
            setNotifications(prev => ({ ...prev, testingActive: active, testingOverdue: overdue }));
        });

        return () => { unsubSite(); unsubShop(); unsubJob(); unsubOther(); unsubDialux(); unsubTesting(); };
    }, [userId]);

    const totalNotifications = notifications.siteVisit + notifications.shopDrawing + notifications.jobRequest + notifications.otherRequest + notifications.dialuxRequest;

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const scrollLeft = e.currentTarget.scrollLeft;
        const width = e.currentTarget.offsetWidth;
        const page = Math.round(scrollLeft / width);
        setCurrentPage(page);
    };

    return (
        <ProtectedPageWrapper>
            <SidebarProvider defaultOpen={false}>
                <AppSidebar userId={userId} />
                <SidebarInset className="bg-[#F2F4F7] relative min-h-screen font-sans pb-safe">

                    {/* Desktop Header */}
                    <header className="hidden md:flex h-20 items-center justify-between px-8 bg-white border-b border-gray-100 sticky top-0 z-50">
                        <div className="flex items-center gap-6">
                            <SidebarTrigger className="hover:bg-gray-100 transition-colors" />
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl overflow-hidden bg-gray-900 shadow-sm">
                                    {userDetails.profilePicture ? <img src={userDetails.profilePicture} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs uppercase">{userDetails.Firstname.substring(0, 2)}</div>}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{getGreeting()}</p>
                                    <h2 className="text-xl font-bold text-gray-900 tracking-tight leading-none">Welcome, {userDetails.Firstname}</h2>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="size-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">System Live</span>
                                </div>
                                <div className="h-3 w-px bg-gray-300" />
                                <div className="flex items-center gap-2">
                                    {getWeatherIcon(weather.condition, 16)}
                                    <span className="text-xs font-black text-gray-900">{weather.temp}</span>
                                </div>
                            </div>
                            
                            <div className="relative" ref={notifRef}>
                                <button 
                                    onClick={() => setIsNotifOpen(!isNotifOpen)}
                                    className="p-2.5 text-gray-400 hover:text-[#E33636] hover:bg-red-50 rounded-xl transition-all relative"
                                >
                                    <Bell size={20} />
                                    {totalNotifications > 0 && <span className="absolute -top-1 -right-1 flex min-w-[20px] h-5 items-center justify-center rounded-full bg-[#E33636] text-[10px] font-bold text-white border-2 border-white px-1 shadow-sm">{totalNotifications}</span>}
                                </button>

                                {isNotifOpen && (
                                    <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                                        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                            <p className="text-xs font-black text-gray-900 uppercase">Notifications</p>
                                            <span className="bg-[#E33636] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">{totalNotifications} New</span>
                                        </div>
                                        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                                            <NotifItem label="Site Visit Requests" count={notifications.siteVisit} icon={CalendarCheck} path="/appointments/site-visit" onClick={() => setIsNotifOpen(false)} />
                                            <NotifItem label="Job Requests" count={notifications.jobRequest} icon={FileText} path="/request/job" onClick={() => setIsNotifOpen(false)} />
                                            <NotifItem label="Dialux Simulation" count={notifications.dialuxRequest} icon={Monitor} path="/request/dialux" onClick={() => setIsNotifOpen(false)} />
                                            <NotifItem label="Shop Drawing" count={notifications.shopDrawing} icon={StreetLightIcon} path="/request/shop-drawing" onClick={() => setIsNotifOpen(false)} />
                                            <NotifItem label="Critical Testing" count={notifications.testingOverdue} icon={AlertTriangle} path="/request/testing" color="text-red-600" onClick={() => setIsNotifOpen(false)} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Mobile Header */}
                    <header className="md:hidden bg-[#E33636] pt-14 pb-20 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 size-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
                        <div className="max-w-7xl mx-auto relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="size-11 rounded-full overflow-hidden border-2 border-white/30 bg-white/10">
                                        {userDetails.profilePicture ? <img src={userDetails.profilePicture} alt="User" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-bold">{userDetails.Firstname[0]}</div>}
                                    </div>
                                    <div className="text-white">
                                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 leading-none mb-1">Hello,</p>
                                        <h1 className="text-xl font-extrabold tracking-tight leading-none">{userDetails.Firstname || "User"}!</h1>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2.5 bg-white/10 text-white rounded-full relative">
                                        <Bell size={20} />
                                        {totalNotifications > 0 && <span className="absolute top-0 right-0 size-4 bg-white text-[#E33636] text-[8px] font-bold rounded-full flex items-center justify-center border border-[#E33636]">{totalNotifications}</span>}
                                    </button>
                                    <SidebarTrigger className="p-2.5 bg-white text-[#E33636] rounded-full shadow-lg" />
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl flex items-stretch shadow-xl overflow-hidden h-[85px]">
                                <div className="flex-[1.2] px-5 flex items-center gap-4">
                                    <div className="p-2 rounded-lg">{getWeatherIcon(weather.condition, 32)}</div>
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-bold text-gray-400 leading-none mb-1">{getGreeting()}!</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-gray-900 leading-none">{formattedTime.split(' ')[0]}</span>
                                            <span className="text-[10px] font-black text-gray-900">{formattedTime.split(' ')[1]}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-px bg-gray-100 my-4" />
                                <div className="flex-1 flex flex-col items-center justify-center px-4">
                                    <p className="text-[9px] font-bold text-gray-300 uppercase mb-1">{weather.condition}</p>
                                    <span className="text-xl font-black text-gray-800 leading-none">{weather.temp}</span>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase mt-1 tracking-tighter text-center">{formattedDate.split(',')[0]}</p>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="px-4 -mt-8 space-y-8 pb-32 relative z-20 md:mt-0 md:px-12 md:py-10">
                        {/* Services Grid */}
                        <section className="bg-white rounded-[24px] py-6 px-4 shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-6 px-2">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Engineering Services</h3>
                                <div className="flex gap-1">
                                    <div className="size-1.5 rounded-full bg-red-100" />
                                    <div className="size-1.5 rounded-full bg-red-500" />
                                </div>
                            </div>

                            <div className="md:hidden">
                                <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar py-3 gap-0" onScroll={handleScroll} ref={scrollRef}>
                                    {[...Array(totalPages)].map((_, pageIndex) => (
                                        <div key={pageIndex} className="min-w-full grid grid-cols-3 gap-y-5 px-2 snap-center">
                                            {services.slice(pageIndex * itemsPerPage, (pageIndex + 1) * itemsPerPage).map((service, i) => (
                                                <button key={i} onClick={() => router.push(service.path)} className="flex flex-col items-center">
                                                    <div className="size-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-3 active:scale-95 transition-all relative group">
                                                        <service.icon className="text-[#E33636] group-active:scale-110 transition-transform" size={28} />
                                                        {service.count > 0 && <span className="absolute -top-1 -right-1 bg-[#E33636] text-white text-[10px] min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-bold border-2 border-white shadow-sm">{service.count}</span>}
                                                    </div>
                                                    <span className="text-[11px] font-bold text-gray-600 text-center leading-tight px-1">{service.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-center gap-3 mt-4">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <div key={i} className={cn("h-1.5 rounded-full transition-all duration-300", currentPage === i ? "w-6 bg-[#E33636]" : "w-2 bg-gray-200")} />
                                    ))}
                                </div>
                            </div>

                            <div className="hidden md:grid grid-cols-7 gap-6">
                                {services.map((service, i) => (
                                    <button key={i} onClick={() => router.push(service.path)} className="flex flex-col items-center group">
                                        <div className="size-14 bg-gray-50 rounded-xl flex items-center justify-center mb-2 group-hover:bg-red-50 group-hover:-translate-y-1 transition-all relative">
                                            <service.icon className="text-[#E33636]" size={24} />
                                            {service.count > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-bold border-2 border-white">{service.count}</span>}
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-500 text-center group-hover:text-gray-900 transition-colors">{service.label}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Overview Tabs & Content */}
                        <section className="space-y-4 px-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Live Monitoring</h3>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                    {tabs.map((tab) => (
                                        <button 
                                            key={tab} 
                                            onClick={() => setActiveTab(tab)} 
                                            className={cn(
                                                "px-6 py-1.5 rounded-full text-[10px] font-bold border transition-all whitespace-nowrap", 
                                                activeTab === tab 
                                                    ? "bg-[#E33636] text-white border-[#E33636] shadow-md scale-105" 
                                                    : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                                            )}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
                                {activeTab === "Monitoring" && (
                                    <>
                                        <ActivityCard label="In-Testing" value={notifications.testingActive} icon={ClipboardCheck} />
                                        <ActivityCard label="Critical" value={notifications.testingOverdue} icon={AlertTriangle} isAlert={notifications.testingOverdue > 0} />
                                        <ActivityCard label="Site Visits" value={notifications.siteVisit} icon={CalendarCheck} />
                                        <ActivityCard label="Shop Drawing" value={notifications.shopDrawing} icon={StreetLightIcon} />
                                    </>
                                )}
                                {activeTab === "Requests" && (
                                    <>
                                        <ActivityCard label="Job" value={notifications.jobRequest} icon={FileText} />
                                        <ActivityCard label="DIAlux" value={notifications.dialuxRequest} icon={Monitor} />
                                        <ActivityCard label="Misc" value={notifications.otherRequest} icon={MoreHorizontal} />
                                        <ActivityCard label="Total" value={totalNotifications} icon={Bell} />
                                    </>
                                )}
                                {(activeTab === "Super Admin" || activeTab === "Admin") && (
                                    <div className="col-span-2 md:col-span-4 py-12 flex flex-col items-center justify-center bg-white rounded-[32px] border border-dashed border-gray-200 shadow-sm">
                                        <div className="size-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                                            <Settings className="text-[#E33636] animate-spin-slow" size={32} />
                                        </div>
                                        <p className="text-xs font-black text-gray-900 uppercase tracking-widest">{activeTab} Dashboard</p>
                                        <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-tight">Privileged Controls Enabled</p>
                                        <button className="mt-6 px-6 py-2 bg-gray-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all">Manage Systems</button>
                                    </div>
                                )}
                                {activeTab === "Projects" && (
                                    <div className="col-span-2 md:col-span-4 py-12 flex flex-col items-center justify-center bg-white rounded-[32px] border border-dashed border-gray-200 shadow-sm">
                                        <div className="size-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                                            <Layers className="text-blue-500" size={32} />
                                        </div>
                                        <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Active Projects</p>
                                        <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-tight text-center px-8">Project tracking is currently under synchronization</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Recent Activity Mockup */}
                        <section className="px-2 pb-10">
                             <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">System Health</h3>
                                    <span className="text-[10px] font-bold text-green-500 uppercase flex items-center gap-1.5">
                                        <div className="size-1.5 bg-green-500 rounded-full animate-pulse" />
                                        All Protocols Nominal
                                    </span>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="size-10 bg-white rounded-xl flex items-center justify-center text-[#E33636] shadow-sm">
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-gray-900 leading-none mb-1">Database Sync</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Firestore Status: Online</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="size-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm">
                                            <CloudSun size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-gray-900 leading-none mb-1">Weather Service</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Real-time Data Active</p>
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </section>
                    </main>

                    {/* Mobile Floating Action Button */}
                    {services.some(s => s.label.includes("Testing")) && (
                        <button 
                            onClick={() => router.push('/request/testing/add')} 
                            className="md:hidden fixed bottom-24 right-6 size-14 bg-[#E33636] text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 z-50 transition-transform ring-4 ring-white"
                        >
                            <Plus size={28} strokeWidth={3} />
                        </button>
                    )}

                    {/* Mobile Navigation Dock */}
                    <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-gray-100 px-8 flex items-center justify-between z-[60] rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                        <button className="flex flex-col items-center gap-1 text-[#E33636]">
                            <Activity size={22} strokeWidth={2.5} />
                            <span className="text-[8px] font-black uppercase tracking-widest">Dash</span>
                        </button>
                        <button onClick={() => router.push('/projects')} className="flex flex-col items-center gap-1 text-gray-300 hover:text-gray-900 transition-colors">
                            <Layers size={22} />
                            <span className="text-[8px] font-bold uppercase tracking-widest">Projects</span>
                        </button>
                        <div className="size-12 -mt-10 bg-white p-1 rounded-full border-t border-gray-100">
                             <button className="size-full bg-gray-900 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all">
                                <Search size={20} />
                             </button>
                        </div>
                        <button onClick={() => router.push('/messages')} className="flex flex-col items-center gap-1 text-gray-300 hover:text-gray-900 transition-colors relative">
                            <MessageSquare size={22} />
                            <span className="text-[8px] font-bold uppercase tracking-widest">Chat</span>
                            {notifications.unreadMessages > 0 && <div className="absolute top-0 right-0 size-2 bg-red-500 rounded-full border-2 border-white" />}
                        </button>
                        <button onClick={() => router.push('/profile')} className="flex flex-col items-center gap-1 text-gray-300 hover:text-gray-900 transition-colors">
                            <User size={22} />
                            <span className="text-[8px] font-bold uppercase tracking-widest">Account</span>
                        </button>
                    </div>

                </SidebarInset>
            </SidebarProvider>
            
            {/* Custom Animations & Global Styles */}
            <style jsx global>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
                .pb-safe {
                    padding-bottom: env(safe-area-inset-bottom);
                }
            `}</style>
        </ProtectedPageWrapper>
    )
}

// --- REUSABLE COMPONENTS ---

function ActivityCard({ label, value, icon: Icon, isAlert }: any) {
    return (
        <div className={cn(
            "bg-white p-5 rounded-[28px] border shadow-sm flex flex-col justify-between h-[125px] transition-all relative overflow-hidden group", 
            isAlert ? "border-red-100 ring-1 ring-red-50 bg-red-50/10" : "border-gray-100 hover:border-gray-200"
        )}>
            <div className="relative z-10">
                <p className={cn("text-[9px] font-black uppercase tracking-widest", isAlert ? "text-red-400" : "text-gray-400")}>{label}</p>
                <div className="flex items-baseline gap-1 mt-1">
                    <p className={cn("text-3xl font-black", isAlert ? "text-red-600" : "text-gray-900")}>{value.toString().padStart(2, '0')}</p>
                    {isAlert && <div className="size-2 bg-red-500 rounded-full animate-ping" />}
                </div>
            </div>
            <div className={cn(
                "size-10 rounded-xl flex items-center justify-center self-end shadow-sm group-hover:scale-110 transition-transform", 
                isAlert ? "bg-red-50 text-red-600" : "bg-gray-50 text-[#E33636]"
            )}>
                <Icon size={20} />
            </div>
            {/* Background Accent */}
            <div className={cn(
                "absolute -bottom-2 -right-2 size-16 rounded-full blur-2xl opacity-10",
                isAlert ? "bg-red-500" : "bg-[#E33636]"
            )} />
        </div>
    )
}

function NotifItem({ label, count, icon: Icon, path, color = "text-gray-900", onClick }: any) {
    const router = useRouter();
    return (
        <button 
            onClick={() => { router.push(path); onClick(); }}
            className="w-full px-5 py-3 hover:bg-gray-50 flex items-center justify-between group transition-colors border-b border-gray-50 last:border-0"
        >
            <div className="flex items-center gap-3">
                <div className="size-9 bg-gray-50 rounded-xl flex items-center justify-center text-[#E33636] group-hover:bg-red-100 transition-colors shadow-sm">
                    <Icon size={18} />
                </div>
                <div className="text-left">
                    <p className={cn("text-[10px] font-black uppercase tracking-tight", color)}>{label}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">System Update</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {count > 0 ? (
                    <span className="bg-red-50 text-[#E33636] text-[10px] font-black px-2 py-0.5 rounded-lg border border-red-100">
                        {count}
                    </span>
                ) : (
                    <span className="text-[9px] font-bold text-gray-300 uppercase">Clear</span>
                )}
                <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-900 transition-colors" />
            </div>
        </button>
    )
}