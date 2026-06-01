"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAppointmentData } from "./layout" 
import ProtectedPageWrapper from "@/components/protected-page-wrapper"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { 
  ChevronDown,
  HelpCircle,
  Check, 
  ArrowRight,
  Loader2,
  ShieldCheck,
  Info,
  Lock,
  ClipboardList,
  Wrench,
  User2,
  MessageSquare,
  AlertCircle,
  Clock,
  HardHat,
  Zap,
  Truck,
  AlertTriangle,
  Users,
  Settings,
  Presentation,
  Gavel,
  Scan,
  Hammer,
  MoreHorizontal
} from "lucide-react"

const getIconForProtocol = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes("concern")) return AlertTriangle;
  if (l.includes("meeting")) return Users;
  if (l.includes("installation")) return Settings;
  if (l.includes("presentation")) return Presentation;
  if (l.includes("bidding")) return Gavel;
  if (l.includes("assessment") || l.includes("assesment")) return Scan;
  if (l.includes("retrofitting")) return Hammer;
  if (l.includes("others")) return MoreHorizontal;
  return Wrench;
}
import { cn } from "@/lib/utils"

// FIREBASE IMPORTS
import { db } from "@/lib/firebase"
import { collection, query, where } from "firebase/firestore"

// Shadcn UI Imports
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// CUSTOM COMPONENTS
import { PageHeader } from "@/components/page-header"

export default function SalesAddAppointmentPage() {
  const router = useRouter()
  const [userId, setUserId] = React.useState<string>("")

  React.useEffect(() => {
    setUserId(localStorage.getItem("userId") || "")
  }, [])

  const { 
    selectedAssistance: selectedTypes, 
    setSelectedAssistance: setSelectedTypes, 
    otherSpec: otherText, 
    setOtherSpec: setOtherText,
    personnel,
    setPersonnel,
    ppe,
    setPpe,
    permits,
    setPermits,
    isHydrated 
  } = useAppointmentData()

  const [options, setOptions] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [currentStep, setCurrentStep] = React.useState(1)
  const [expandedObjectives, setExpandedObjectives] = React.useState<string[]>([])

  const toggleObjectives = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedObjectives(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setList(list.includes(value) ? list.filter(i => i !== value) : [...list, value]);
  };

  // 1. SYNC PROTOCOL OPTIONS FROM FIREBASE — one-time read, not a persistent listener
  // Protocols rarely change; a getDocs is sufficient and saves quota vs onSnapshot.
  React.useEffect(() => {
    const fetchProtocols = async () => {
      try {
        const { getDocs } = await import("firebase/firestore");
        const q = query(collection(db, "protocols"), where("isActive", "==", true));
        const snapshot = await getDocs(q);
        const fetchedOptions = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            label: data.label,
            desc: data.desc,
            missionObjectives: data.description || data.missionObjectives,
            hasPic: Array.isArray(data.pic) ? data.pic.length > 0 : !!data.pic
          };
        });
        
        const hasOthersInDb = fetchedOptions.some(opt => opt.label.toLowerCase() === "others");
        if (!hasOthersInDb) {
          fetchedOptions.push({
            id: "others", 
            label: "Others",
            desc: "Any requirement not covered by standard protocols.",
            missionObjectives: "",
            hasPic: true 
          });
        }
        setOptions(fetchedOptions);
      } catch (err) {
        console.error("PROTOCOLS_FETCH_ERROR", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProtocols();
  }, []);

  const toggleAssistance = (id: string, hasPic: boolean) => {
    // SECURITY: Prevent state modification until context is hydrated
    if (!hasPic || !isHydrated) return;

    setSelectedTypes((prev: string[]) => {
      const isSelecting = !prev.includes(id);
      
      // Auto-expand/collapse objectives based on selection
      setExpandedObjectives(currentExpanded => 
        isSelecting 
          ? [...currentExpanded, id] 
          : currentExpanded.filter(i => i !== id)
      );

      return isSelecting 
        ? [...prev, id] 
        : prev.filter((t: string) => t !== id);
    });
  }

  const isOthersSelected = selectedTypes.includes("others") || 
    selectedTypes.some((id: string) => options.find(o => o.id === id)?.label.toLowerCase() === "others");

  const isOthersValid = isOthersSelected ? otherText.trim().length > 0 : true
  
  // LOGIC: Enable transition only when context is recovered and criteria met
  const canSubmit = isHydrated && selectedTypes.length > 0 && isOthersValid

  return (
    <TooltipProvider delayDuration={200}>
      <AppSidebar userId={userId} />
      <SidebarInset className="bg-[#F8FAFA] pb-24 md:pb-10 min-h-screen m-0 rounded-none border-none shadow-none overflow-visible">
        <PageHeader 
          title="VISIT REQUIREMENTS" 
          version="V2.8" 
          showBackButton={true}
          trigger={<SidebarTrigger className="mr-2" />}
          actions={
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-50 border border-zinc-200 rounded-lg">
              {!isHydrated ? (
                <Loader2 className="size-3 animate-spin text-zinc-400" />
              ) : (
                <ShieldCheck className="size-3 text-zinc-400" />
              )}
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-900">
                Step {currentStep === 1 ? "1" : currentStep === 2 ? "1.5" : "1.8"} of 4
              </span>
            </div>
          }
        />

        <main className="flex-1 px-3 py-3 md:p-5 max-w-2xl mx-auto w-full pb-[120px]">
          
          {/* STEP INDICATORS - ULTRA COMPACT */}
          <div className="mb-4 bg-white p-1 rounded-xl shadow-sm border border-zinc-100 flex justify-between items-center gap-1 overflow-x-auto scrollbar-hide">
            {[
              { id: 1, label: "Assistance", icon: Zap },
              { id: 2, label: "Safety", icon: ShieldCheck },
              { id: 3, label: "Logistics", icon: Truck }
            ].map((step) => (
              <button 
                key={step.id} 
                onClick={() => isHydrated && setCurrentStep(step.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap active:scale-95",
                  currentStep === step.id 
                    ? "bg-zinc-900 text-white shadow-sm" 
                    : "text-zinc-400 hover:bg-zinc-50"
                )}
              >
                <step.icon size={11} /> 
                <span className="text-[8px] font-black uppercase tracking-widest">{step.label}</span>
              </button>
            ))}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            {currentStep === 1 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-zinc-100 shadow-sm">
                  <div className="size-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <ClipboardList size={14} />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-tight leading-none">Visit Purpose</h3>
                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                      Select help type.
                    </p>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  {loading || !isHydrated ? (
                    <div className="flex flex-col items-center justify-center py-12 border border-zinc-100 rounded-xl bg-white shadow-sm">
                      <Loader2 className="size-4 animate-spin mb-2 text-zinc-200" />
                      <span className="text-[7px] font-black uppercase tracking-[0.2em] text-zinc-300">
                        Loading...
                      </span>
                    </div>
                  ) : (
                    options.map((option) => {
                      const isActive = selectedTypes.includes(option.id);
                      const isSelectable = option.hasPic;
                      const isExpanded = expandedObjectives.includes(option.id);
                      const ProtocolIcon = getIconForProtocol(option.label);

                      return (
                        <div 
                          key={option.id}
                          onClick={() => toggleAssistance(option.id, option.hasPic)}
                          className={cn(
                            "group relative flex flex-col p-2.5 transition-all border rounded-xl shadow-sm active:scale-[0.99] cursor-pointer overflow-hidden",
                            isActive 
                              ? "border-zinc-900 bg-white ring-1 ring-zinc-900/5" 
                              : "border-zinc-100 bg-white hover:border-zinc-200",
                            !isSelectable && "opacity-40 cursor-not-allowed bg-zinc-50 border-dashed"
                          )}
                        >
                          <div className="flex items-start gap-2.5 w-full">
                            <div className={cn(
                              "mt-0.5 size-3.5 rounded-full border flex items-center justify-center transition-all shrink-0",
                              isActive ? "bg-zinc-900 border-zinc-900" : "bg-zinc-50 border-zinc-200",
                            )}>
                              {isActive ? <Check className="size-2 text-white stroke-[4px]" /> : <div className="size-1 bg-zinc-200 rounded-full" />}
                            </div>

                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 truncate">
                                  <ProtocolIcon size={11} className={cn(isActive ? "text-zinc-900" : "text-zinc-400")} />
                                  <span className={cn(
                                    "text-[10px] font-black uppercase tracking-tight",
                                    isActive ? "text-zinc-900" : "text-zinc-600"
                                  )}>
                                    {option.label}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-1.5">
                                  {!isSelectable && (
                                    <div className="bg-amber-50 text-amber-600 px-1 py-0.5 rounded text-[5px] font-black uppercase tracking-widest border border-amber-100 whitespace-nowrap">
                                      No PIC
                                    </div>
                                  )}
                                  {option.missionObjectives && (
                                    <button 
                                      onClick={(e) => toggleObjectives(option.id, e)}
                                      className={cn(
                                        "flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all border",
                                        isExpanded 
                                          ? "bg-zinc-900 border-zinc-900 text-white shadow-sm" 
                                          : "bg-zinc-50 border-zinc-100 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                                      )}
                                    >
                                      <HelpCircle size={8} />
                                      <span className="text-[6px] font-black uppercase tracking-tighter">Info</span>
                                      <ChevronDown size={8} className={cn("transition-transform duration-300", isExpanded && "rotate-180")} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              {option.desc && (
                                <span className="text-[8px] font-bold text-zinc-400 mt-0.5 leading-tight uppercase tracking-tight">
                                  {option.desc}
                                </span>
                              )}
                            </div>
                            
                            {isActive && (
                              <div className="mt-0.5 size-4 rounded-full bg-zinc-900 flex items-center justify-center text-white animate-in zoom-in duration-200 shrink-0">
                                <Check className="size-2.5" strokeWidth={3} />
                              </div>
                            )}
                          </div>

                          {option.missionObjectives && isExpanded && (
                            <div className={cn(
                              "mt-2 p-2.5 rounded-lg border animate-in slide-in-from-top-2 duration-300",
                              isActive ? "bg-blue-50/50 border-blue-100/50 shadow-sm ring-1 ring-blue-500/10" : "bg-zinc-50/50 border-zinc-100"
                            )}>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <HelpCircle size={9} className="text-blue-500 shrink-0" />
                                <span className="text-[7px] font-black uppercase tracking-widest text-blue-600/80">Objective Detail</span>
                              </div>
                              <p className="text-[10px] font-bold text-zinc-600 leading-relaxed tracking-tight uppercase">
                                {option.missionObjectives}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}

                  {isOthersSelected && (
                    <div className="mt-1.5 space-y-2 p-3 bg-zinc-50 border border-zinc-100 rounded-xl animate-in slide-in-from-top-1 duration-200">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="size-5 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                          <MoreHorizontal size={10} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-tight text-zinc-900">Others</span>
                      </div>
                      <Input
                        placeholder="Specify..."
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        className="rounded-lg border-zinc-200 h-8 text-[9px] font-bold uppercase tracking-tight px-2 focus:ring-zinc-900 transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-zinc-100 shadow-sm">
                  <div className="size-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                    <ShieldCheck size={14} />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-tight leading-none">Safety</h3>
                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                      PPE selection.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white border border-zinc-100 rounded-xl shadow-sm">
                  <Label className="text-[8px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2 mb-2">
                    <HardHat size={10} /> PPE Required
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["Hard Hat", "Safety Shoes", "Vest"].map(item => (
                      <div key={item} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50/50 border border-transparent hover:border-zinc-100 transition-all cursor-pointer">
                        <Checkbox id={`ppe-${item}`} checked={ppe.includes(item)} onCheckedChange={() => toggleItem(ppe, setPpe, item)} className="size-3.5" />
                        <label htmlFor={`ppe-${item}`} className="text-[9px] font-bold text-zinc-600 uppercase cursor-pointer flex-1">{item}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-zinc-100 shadow-sm">
                  <div className="size-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Truck size={14} />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-tight leading-none">Logistics</h3>
                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                      Access.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white border border-zinc-100 rounded-xl shadow-sm">
                  <Label className="text-[8px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2 mb-2">
                    <MessageSquare size={10} /> Permits
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["Gate Pass", "Car Pass"].map(item => (
                      <div key={item} className="flex items-center gap-2 p-2 rounded-lg border border-zinc-50 hover:bg-zinc-50 cursor-pointer transition-all">
                        <Checkbox id={`permits-${item}`} checked={permits.includes(item)} onCheckedChange={() => toggleItem(permits, setPermits, item)} className="size-3.5" />
                        <label htmlFor={`permits-${item}`} className="text-[9px] font-bold text-zinc-700 uppercase cursor-pointer flex-1">{item}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* BOTTOM NAV BAR - ULTRA COMPACT */}
        <div className="fixed bottom-4 right-3 left-3 md:left-auto md:bottom-6 md:right-6 z-[60] flex gap-2">
          {currentStep > 1 && (
            <Button 
              onClick={() => setCurrentStep(prev => prev - 1)}
              variant="outline"
              className="h-10 px-6 rounded-full font-black uppercase text-[9px] tracking-[0.15em] bg-white border-zinc-200 shadow-lg"
            >
              Back
            </Button>
          )}
          {currentStep < 3 ? (
            <Button 
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canSubmit}
              className={cn(
                "flex-1 md:w-auto h-10 px-8 rounded-full font-black uppercase text-[9px] tracking-[0.15em] flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.95]", 
                canSubmit 
                  ? "bg-zinc-900 text-white hover:bg-zinc-800 hover:scale-105" 
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"
              )}
            >
              Next Step
              <ArrowRight className="size-3" />
            </Button>
          ) : (
            <Button 
              onClick={() => router.push("/appointments/site-visit/add/schedule")}
              disabled={!canSubmit}
              className={cn(
                "flex-1 md:w-auto h-10 px-8 rounded-full font-black uppercase text-[9px] tracking-[0.15em] flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.95]", 
                canSubmit 
                  ? "bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 shadow-emerald-200" 
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"
              )}
            >
              Schedule
              <ArrowRight className="size-3" />
            </Button>
          )}
        </div>
      </SidebarInset>
    </TooltipProvider>
  )
}