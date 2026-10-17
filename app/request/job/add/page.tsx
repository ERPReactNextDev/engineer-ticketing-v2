"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Plus, Send, Loader2, Wrench, FileText, X, ShieldCheck, Clock, Camera, ClipboardCheck,
  AlertCircle, CheckCircle2, ChevronRight, Calendar, Info, ChevronDown, Check, FlaskConical, MapPin
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/page-header";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { toast } from "sonner";
import { sendNotificationToHierarchy, NotificationTemplates } from "@/lib/notification-service";
import { getNextJobRequestNumber, releaseReservedNumber } from "@/lib/job-request-counter";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Database
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// MapPicker component (client-side only for Leaflet)
import dynamicImport from "next/dynamic";
const MapPicker = dynamicImport(() => import("@/components/map-picker"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-xl">
      <Loader2 className="size-6 animate-spin text-slate-400" />
    </div>
  ),
});

export default function JobRequestWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isTestMode, setIsTestMode] = useState(false);

  // FORM STATES
  const [formData, setFormData] = useState({
    projectTitle: "",
    location: "",
    locationCoordinates: { lat: 0, lng: 0 },
    agentName: "",
    projectName: "",
    contactPerson: "",
    email: "",
    contactNumber: "",
    scopeOfWork: "",
    mountingHeight: "",
    workingTimeFrom: "",
    workingTimeTo: "",
    otherAssistance: "",
    otherDocuments: "",
    priority: "MEDIUM",
    tempFacility: "No",
    safetyInduction: "No",
    safetyNotes: "",
  });

  const [siteInstallation, setSiteInstallation] = useState<string[]>([]);
  const [inHouse, setInHouse] = useState<string[]>([]);
  const [permits, setPermits] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // CUSTOMER DATABASE STATES
  const [userDetails, setUserDetails] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [openCustomer, setOpenCustomer] = useState(false);
  const [isCustomerSelected, setIsCustomerSelected] = useState(false);

  // MAP STATES
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Pre-calculate memoized accounts for better responsiveness
  const memoizedAccounts = React.useMemo(() => accounts, [accounts]);

  const isInitialLoading = loadingUser;

  // Use debounce for search
  const debouncedSearch = useDebounce(searchQuery, 500);

  // FETCH ACCOUNTS WITH PAGINATION & SEARCH
  const fetchAccounts = React.useCallback(async (offset = 0, search = "") => {
    if (!userDetails?.referenceid && userDetails?.department !== "IT") return;
    
    if (offset === 0) setLoadingAccounts(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        referenceid: userDetails.referenceid,
        role: userDetails.role,
        name: userDetails.name,
        department: userDetails.department,
        search: search,
        offset: offset.toString(),
        limit: "50"
      });
      
      const response = await fetch(`/api/com-fetch-cluster-account?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const result = await response.json();
      
      if (offset === 0) {
        setAccounts(result.data || []);
      } else {
        setAccounts(prev => [...prev, ...(result.data || [])]);
      }
      
      setTotalAccounts(result.total || 0);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error("ACCOUNTS_FETCH_ERROR", err);
    } finally {
      setLoadingAccounts(false);
      setLoadingMore(false);
    }
  }, [userDetails]);

  React.useEffect(() => {
    fetchAccounts(0, debouncedSearch);
  }, [fetchAccounts, debouncedSearch]);

  const loadMoreAccounts = () => {
    if (!loadingMore && hasMore) {
      fetchAccounts(accounts.length, debouncedSearch);
    }
  };

  // Save to draft only if user is logged in
  useEffect(() => {
    const storedId = localStorage.getItem("userId");
    if (storedId) {
      setUserId(storedId);
    }

    // Load test mode state
    setIsTestMode(localStorage.getItem("testMode") === "true");

    // Fetch User Details
    if (storedId) {
      setLoadingUser(true);
      fetch(`/api/user?id=${encodeURIComponent(storedId)}`)
        .then(res => res.json())
        .then(data => {
          setUserDetails({
            referenceid: data.ReferenceID || "",
            tsm: data.TSM || "",
            manager: data.Manager || "",
            department: data.Department || data.department || "",
            role: data.Role || data.role || "MEMBER",
            engiconnectRole: data.engiconnect_role || "MEMBER",
            name: `${data.Firstname || ""} ${data.Lastname || ""}`.trim()
          });
          // Auto-populate agentName with ReferenceID
          if (data.ReferenceID) {
            setFormData(prev => ({ ...prev, agentName: data.ReferenceID }));
          } else {
            setFormData(prev => ({ ...prev, agentName: prev.agentName || "" }));
          }
        })
        .catch(err => console.error("USER_FETCH_ERROR", err))
        .finally(() => setLoadingUser(false));
    }
    
    // Load from localStorage if exists
    const saved = localStorage.getItem("job_request_draft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...(parsed.formData || {}) }));
        setSiteInstallation(parsed.siteInstallation || []);
        setInHouse(parsed.inHouse || []);
        setPermits(parsed.permits || []);
        setWorkingDays(parsed.workingDays || []);
        if (parsed.savedAt) setLastSaved(new Date(parsed.savedAt));
      } catch (e) {
        console.error("Failed to load draft:", e);
      }
    }
  }, []);

  // Save draft on changes
  useEffect(() => {
    if (userId) {
      const timer = setTimeout(() => {
        localStorage.setItem("job_request_draft", JSON.stringify({
          formData, siteInstallation, inHouse, permits, workingDays,
          savedAt: new Date().toISOString()
        }));
        setLastSaved(new Date());
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [formData, siteInstallation, inHouse, permits, workingDays, userId]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if (currentStep < 3) {
          if (currentStep === 2) {
            if (!formData.projectTitle?.trim() || !formData.location?.trim() || !formData.agentName?.trim() || !formData.projectName?.trim() || !formData.scopeOfWork?.trim()) {
              return toast.error("Please fill in Project Title, Location, Agent Name, Project Name, and Scope of Work.");
            }
          }
          setCurrentStep(prev => prev + 1);
        } else if (currentStep === 3 && !isSubmitting) {
          handleSubmit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, formData, isSubmitting]);

  // Test mode toggle function
  const toggleTestMode = () => {
    const newMode = !isTestMode;
    setIsTestMode(newMode);
    localStorage.setItem("testMode", newMode.toString());
    toast.info(
      newMode 
        ? "🔧 Test mode enabled - Job number will have TEST- prefix" 
        : "✅ Test mode disabled - Using production job number",
      { duration: 3000 }
    );
  };

  // Keyboard shortcut: Ctrl+Shift+M to toggle test mode (M for "mode")
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        toggleTestMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTestMode]);

  const clearDraft = () => {
    localStorage.removeItem("job_request_draft");
  };

  const toggleItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setList(list.includes(value) ? list.filter(i => i !== value) : [...list, value]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const imageFiles = selectedFiles.filter(file => file.type.startsWith("image/"));
      
      if (imageFiles.length !== selectedFiles.length) {
        toast.error("Only image files are allowed. Some files were skipped.");
      }

      if (imageFiles.length > 0) {
        setFiles((prev) => [...prev, ...imageFiles]);
      }
    }
  };

  // --- UPDATED UPLOAD LOGIC (Matching your working reference) ---
  const handleDirectUpload = async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "Xchire"); // Your working preset

    try {
      // Using your working Cloudinary URL
      const res = await fetch("https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      return json.secure_url;
    } catch (error) {
      console.error("Cloudinary Error:", error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !userId) return;
    if (!formData.projectTitle?.trim() || !formData.location?.trim() || !formData.agentName?.trim() || !formData.projectName?.trim()) {
      return toast.error("Please fill in Project Title, Location, Agent Name, and Project Name.");
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Syncing with engiconnect...");

    try {
      let uploadedUrls: string[] = [];

      // 1. Upload all images if they exist
      if (files.length > 0) {
        toast.loading(`Uploading ${files.length} photos...`, { id: toastId });
        
        // Upload all files at the same time
        const uploadPromises = files.map(file => handleDirectUpload(file));
        const results = await Promise.all(uploadPromises);
        
        // Filter out any that failed
        uploadedUrls = results.filter((url): url is string => url !== null);
        
        if (uploadedUrls.length === 0) {
          throw new Error("Photo upload failed. Please try again.");
        }
      }

      // 2. Generate unique job request number (with high-concurrency protection)
      const isTestMode = localStorage.getItem("testMode") === "true";
      const jobRequestNo = await getNextJobRequestNumber(isTestMode);

      // 3. Save to Firestore
      const userName = localStorage.getItem("userName") || "Unknown User";
      const userRole = localStorage.getItem("userRole") || "MEMBER";

      // Fetch user's details including ReferenceID and signature
      let userReferenceId = userId;
      let userSignature = "";
      try {
        const userRes = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        const userData = await userRes.json();
        if (userData?.ReferenceID) {
          userReferenceId = userData.ReferenceID;
        }
        if (userData?.signatureImage) {
          userSignature = userData.signatureImage;
        }
      } catch (err) {
        console.error("Failed to fetch user details:", err);
      }

      await addDoc(collection(db, "job_requests"), {
        ...formData,
        siteInstallation,
        inHouse,
        permits,
        workingDays,
        attachments: uploadedUrls,
        jobRequestNo, // Unique sequential number: JR2026-0042
        status: "JR FORM FORWARD TO ENGINEERING",
        createdBy: userReferenceId,
        createdBySignature: userSignature,
        submittedBy: userReferenceId,
        submittedByName: userName,
        submittedByRole: userRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. Release the number reservation after successful save
      await releaseReservedNumber(jobRequestNo);

      toast.success("Job request synced successfully.", { id: toastId });
      clearDraft(); // Clear draft after successful submission

      // Send push notification to hierarchy (user's TSM/Manager + admins)
      const notifResult = await sendNotificationToHierarchy(
        NotificationTemplates.jobRequest.created(userName, formData.projectName),
        userId,
        { triggeredBy: userId }
      );
      if (notifResult.success) {
        console.log(`Push notification: ${notifResult.message}`);
      }

      router.push("/request/job");
    } catch (e: any) {
      console.error("Submission Error:", e);
      toast.error(e.message || "System connection error.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isInitialLoading) {
    return (
      <ProtectedPageWrapper>
        <SidebarProvider defaultOpen={false}>
          <AppSidebar userId={userId || ""} />
          <SidebarInset className="bg-[#F8FAFC] min-h-screen">
            <div className="p-4 md:p-8 space-y-8 animate-pulse">
              {/* Header Skeleton */}
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-64 bg-slate-200 rounded-lg" />
                  <Skeleton className="h-4 w-48 bg-slate-100 rounded-lg" />
                </div>
                <Skeleton className="h-10 w-32 bg-slate-200 rounded-xl" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Content Skeleton */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Step Indicator Skeleton */}
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-3 gap-4">
                      <Skeleton className="h-10 w-full bg-slate-100 rounded-lg" />
                      <Skeleton className="h-10 w-full bg-slate-100 rounded-lg" />
                      <Skeleton className="h-10 w-full bg-slate-100 rounded-lg" />
                    </div>
                  </div>

                  {/* Form Content Skeleton */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-8 min-h-[500px]">
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-48 bg-slate-200 rounded-lg" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Skeleton className="h-12 w-full bg-slate-50 rounded-xl" />
                        <Skeleton className="h-12 w-full bg-slate-50 rounded-xl" />
                      </div>
                    </div>
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                      <Skeleton className="h-6 w-48 bg-slate-200 rounded-lg" />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                          <Skeleton key={i} className="h-16 w-full bg-slate-50 rounded-xl" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar Summary Skeleton */}
                <div className="lg:col-span-4 space-y-4">
                  <Skeleton className="h-[300px] w-full bg-slate-100 rounded-2xl" />
                  <Skeleton className="h-48 w-full bg-slate-100 rounded-2xl" />
                </div>
              </div>

              <div className="flex flex-col items-center pt-8">
                <Loader2 className="size-6 animate-spin text-slate-300 mb-2" />
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 italic">
                  Syncing_Database...
                </p>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ProtectedPageWrapper>
    );
  }

  return (
    <ProtectedPageWrapper>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar userId={userId || ""} />
        <SidebarInset className="bg-[#F8FAFC] min-h-screen">
          <PageHeader 
            title="New Job Request" 
            version="2.2.1" 
            showBackButton={true}
            trigger={<SidebarTrigger className="mr-2" />}
            actions={
              <div className="flex items-center gap-2">
                {/* Test Mode Toggle Button */}
                <Button
                  variant={isTestMode ? "default" : "outline"}
                  size="sm"
                  onClick={toggleTestMode}
                  className={cn(
                    "h-8 px-3 text-[10px] font-bold uppercase tracking-wider gap-1.5 transition-all",
                    isTestMode 
                      ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" 
                      : "border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  )}
                  title="Toggle test mode (Ctrl+Shift+M)"
                >
                  <FlaskConical className="size-3.5" />
                  <span className="hidden sm:inline">{isTestMode ? "Test Mode" : "Test"}</span>
                  <span className="sm:hidden">{isTestMode ? "ON" : "OFF"}</span>
                </Button>
              </div>
            }
          />
          
          <main className="p-2 md:p-4 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-140px)] overflow-hidden">
            <div className="lg:col-span-8 flex flex-col min-h-0 space-y-3">
              {/* STEP INDICATORS & PROGRESS */}
              <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 space-y-1.5 shrink-0">
                <div className="grid grid-cols-3 gap-1 w-full relative">
                  {[
                    { id: 1, label: "Assistance", icon: Wrench },
                    { id: 2, label: "Scope", icon: FileText },
                    { id: 3, label: "Logistics", icon: Clock }
                  ].map((step) => (
                    <button 
                      key={step.id} 
                      onClick={() => {
                        // Simple validation before allowing step jump
                        if (currentStep === 1 && step.id > 1) {
                          // Allow going to Scope without validation if coming from Assistance
                        }
                        if (currentStep === 2 && step.id > 2) {
                          if (!formData.projectTitle?.trim() || !formData.location?.trim() || !formData.agentName?.trim() || !formData.projectName?.trim() || !formData.scopeOfWork?.trim()) {
                            return toast.error("Please fill in Project Title, Location, Agent Name, Project Name, and Scope of Work.");
                          }
                        }
                        setCurrentStep(step.id);
                      }}
                      className={`group flex items-center justify-center gap-2 px-2 py-2 rounded-lg transition-all w-full min-w-0 ${currentStep === step.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                      <step.icon size={12} className={`shrink-0 ${currentStep === step.id ? 'animate-pulse' : ''}`} /> 
                      <span className="text-[11px] font-black uppercase tracking-tight truncate">{step.label}</span>
                      {currentStep > step.id && <CheckCircle2 size={12} className="shrink-0 text-emerald-400 ml-1" />}
                      
                      {/* Tooltip on hover */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Go to {step.label}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden px-1">
                  <div 
                    className="h-full bg-slate-900 transition-all duration-500 ease-out rounded-full" 
                    style={{ width: `${(currentStep / 3) * 100}%` }}
                  />
                </div>
              </div>

              <Card className="shadow-lg border-none rounded-[1.2rem] bg-white overflow-hidden flex flex-col flex-1 min-h-0 ring-1 ring-slate-200/50">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-2.5 px-6 shrink-0 flex flex-row items-center justify-between">
                  <CardTitle className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500 flex items-center gap-2">
                    <span className="bg-slate-900 text-white size-5 rounded flex items-center justify-center text-[10px] animate-bounce">{currentStep}</span>
                    {currentStep === 1 && "Assistance Selection"}
                    {currentStep === 2 && "Scope & Site Details"}
                    {currentStep === 3 && "Logistics & Schedule"}
                  </CardTitle>
                  
                  {lastSaved && (
                    <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-emerald-500 animate-in fade-in duration-500">
                      <div className="size-1 bg-emerald-500 rounded-full animate-pulse" />
                      Draft Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-5 flex-1 overflow-y-auto">
                  {currentStep === 1 && (
                    <div className="w-full space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                            Site Installation
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info size={10} className="text-slate-300 hover:text-slate-500 transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-[9px] font-bold">Select the type of installation service needed</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <div className="grid grid-cols-1 gap-2">
                            {["New Installation", "Replacement", "Solar LED Lights", "Non-Solar LED Lights"].map(item => (
                              <div key={item} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors w-full group">
                                <Checkbox checked={siteInstallation.includes(item)} onCheckedChange={() => toggleItem(siteInstallation, setSiteInstallation, item)} />
                                <span className="text-[11px] font-bold text-slate-700 uppercase group-hover:text-slate-900 transition-colors">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                            Item Modification
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info size={10} className="text-slate-300 hover:text-slate-500 transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-[9px] font-bold">Select any modifications required for existing items</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <div className="grid grid-cols-1 gap-2">
                            {["Rewiring", "Painting", "Assembly"].map(item => (
                              <div key={item} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors w-full group">
                                <Checkbox checked={inHouse.includes(item)} onCheckedChange={() => toggleItem(inHouse, setInHouse, item)} />
                                <span className="text-[11px] font-bold text-slate-700 uppercase group-hover:text-slate-900 transition-colors">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="w-full space-y-4 animate-in slide-in-from-right-4 duration-300">
                      <div className={`grid gap-6 ${userDetails?.referenceid ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                            Project Title <span className="text-red-500 font-black">*</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info size={10} className="text-slate-300" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-[9px] font-bold">The official title of the project</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <Input className="h-11 rounded-xl font-bold text-[12px] w-full focus:ring-2 focus:ring-slate-900/10 transition-all" placeholder="Enter project title" value={formData.projectTitle} onChange={e => setFormData({...formData, projectTitle: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                            Location <span className="text-red-500 font-black">*</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info size={10} className="text-slate-300" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-[9px] font-bold">Site location or address</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              className="h-11 rounded-xl font-bold text-[12px] flex-1 focus:ring-2 focus:ring-slate-900/10 transition-all"
                              placeholder="Select location from map"
                              value={formData.location}
                              onChange={e => setFormData({...formData, location: e.target.value})}
                              readOnly
                            />
                            <Button
                              type="button"
                              onClick={() => setShowMapPicker(true)}
                              className="h-11 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all"
                            >
                              <MapPin size={16} />
                            </Button>
                          </div>
                        </div>
                        {!userDetails?.referenceid && (
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                            Agent Name <span className="text-red-500 font-black">*</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info size={10} className="text-slate-300" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-[9px] font-bold">Agent Reference ID</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <Input className="h-11 rounded-xl font-bold text-[12px] w-full focus:ring-2 focus:ring-slate-900/10 transition-all" placeholder={userDetails?.referenceid || "RP-CSR-XXXXXX"} value={formData.agentName} onChange={e => setFormData({...formData, agentName: e.target.value})} />
                        </div>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between w-full">
                            <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                              Customer / Account
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info size={10} className="text-slate-300" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-[9px] font-bold">Select a customer from your database</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </Label>
                            <div className="flex items-center gap-1.5">
                              {isCustomerSelected && (
                                <button 
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      projectName: "",
                                      contactPerson: "",
                                      email: "",
                                      contactNumber: ""
                                    }));
                                    setIsCustomerSelected(false);
                                  }}
                                  className="h-6 px-2 text-[7px] font-black uppercase bg-red-50 text-red-600 border border-red-100 rounded-full hover:bg-red-100 transition-all active:scale-95 flex items-center gap-1"
                                >
                                  <X size={8} />
                                  Clear
                                </button>
                              )}
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-full border border-slate-200">
                                <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest">Database:</span>
                                {loadingAccounts ? (
                                  <Loader2 className="size-2 animate-spin text-slate-400 ml-1" />
                                ) : (
                                  <span className="text-[8px] font-black text-slate-900 ml-1">{totalAccounts}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Popover open={openCustomer} onOpenChange={setOpenCustomer}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openCustomer}
                                className={cn(
                                  "w-full justify-between h-11 rounded-xl font-bold text-[12px] bg-white border-slate-200 hover:bg-slate-50 transition-all",
                                  !formData.projectName && "text-slate-400"
                                )}
                                disabled={loadingAccounts && accounts.length === 0}
                              >
                                <span className="truncate">
                                  {loadingAccounts && accounts.length === 0 ? (
                                    <span className="flex items-center gap-2">
                                      <Loader2 className="size-4 animate-spin" />
                                      Syncing Database...
                                    </span>
                                  ) : (
                                    formData.projectName || "Select Customer..."
                                  )}
                                </span>
                                {!loadingAccounts && <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput 
                                  placeholder="Search customer..." 
                                  className="h-9 text-[12px]" 
                                  value={searchQuery}
                                  onValueChange={setSearchQuery}
                                />
                                <CommandList className="max-h-[300px] overflow-y-auto" onScroll={(e) => {
                                  const target = e.currentTarget;
                                  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 1) {
                                    loadMoreAccounts();
                                  }
                                }}>
                                  <CommandEmpty className="py-3 text-[11px] text-center">
                                    {loadingAccounts ? "Searching..." : "No customer found."}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {memoizedAccounts.map((account) => (
                                      <CommandItem
                                        key={account.id}
                                        value={account.company_name}
                                        onSelect={() => {
                                          setFormData(prev => ({
                                            ...prev,
                                            projectName: account.company_name,
                                            contactPerson: Array.isArray(account.contact_person) ? account.contact_person.join(", ") : account.contact_person || "",
                                            email: Array.isArray(account.email_address) ? account.email_address.join(", ") : account.email_address || "",
                                            contactNumber: Array.isArray(account.contact_number) ? account.contact_number.join(", ") : account.contact_number || "",
                                          }));
                                          setIsCustomerSelected(true);
                                          setOpenCustomer(false);
                                        }}
                                        className="text-[11px] font-bold uppercase"
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            formData.projectName === account.company_name ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {account.company_name}
                                      </CommandItem>
                                    ))}
                                    {loadingMore && (
                                      <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                                      </div>
                                    )}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                            Project / Site Name <span className="text-red-500 font-black">*</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info size={10} className="text-slate-300" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-[9px] font-bold">The specific project site or building name</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <Input className="h-11 rounded-xl font-bold text-[12px] w-full focus:ring-2 focus:ring-slate-900/10 transition-all" placeholder="Solar Lights Installation - Building A" value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})} />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Contact Person</Label>
                          <Input 
                            className="h-11 rounded-xl font-bold text-[12px] w-full focus:ring-2 focus:ring-slate-900/10 transition-all disabled:opacity-70 disabled:cursor-not-allowed" 
                            placeholder="John Doe, Jane Smith" 
                            value={formData.contactPerson} 
                            onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                            disabled={isCustomerSelected}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Email Address</Label>
                          <Input 
                            className="h-11 rounded-xl font-bold text-[12px] w-full focus:ring-2 focus:ring-slate-900/10 transition-all disabled:opacity-70 disabled:cursor-not-allowed" 
                            placeholder="email@example.com" 
                            value={formData.email} 
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            disabled={isCustomerSelected}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Contact Number</Label>
                          <Input 
                            className="h-11 rounded-xl font-bold text-[12px] w-full focus:ring-2 focus:ring-slate-900/10 transition-all disabled:opacity-70 disabled:cursor-not-allowed" 
                            placeholder="0917..., (02)..." 
                            value={formData.contactNumber} 
                            onChange={e => setFormData({...formData, contactNumber: e.target.value})}
                            disabled={isCustomerSelected}
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                            Priority <span className="text-red-500 font-black">*</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info size={10} className="text-slate-300" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-[9px] font-bold">How urgent is this request?</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <div className="flex gap-2 w-full">
                            {["LOW", "MEDIUM", "HIGH"].map(p => (
                              <button
                                key={p}
                                onClick={() => setFormData({...formData, priority: p})}
                                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all border-2 ${formData.priority === p ? (p === 'HIGH' ? 'bg-red-500 border-red-500 text-white' : p === 'MEDIUM' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-blue-500 border-blue-500 text-white') : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5 w-full">
                        <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                          Scope of Work <span className="text-red-500 font-black">*</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info size={10} className="text-slate-300" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-[9px] font-bold">Detailed description of tasks to be performed</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                        <Textarea className="min-h-[160px] rounded-xl p-3 text-[12px] w-full focus:ring-2 focus:ring-slate-900/10 transition-all" placeholder="QTY, Item Name, Provide details or works to be accomplished..." value={formData.scopeOfWork} onChange={e => setFormData({...formData, scopeOfWork: e.target.value})} />
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="w-full space-y-4 animate-in slide-in-from-right-4 duration-300">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                            Documents Need for Work Permit
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info size={12} className="text-slate-300 hover:text-slate-500 transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-[9px] font-bold">Standard site requirements for workers</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <div className="space-y-2">
                            {[
                              { id: "Medical Certificate", label: "Medical Certificate" },
                              { id: "NBI Clearance", label: "NBI Clearance" },
                              { id: "NC2 Certification", label: "NC2 Certification for Skilled Workers (Electrician, Scaffolder, etc)" },
                              { id: "Safety Officer Cert", label: "Safety Officer Certification" }
                            ].map(item => (
                              <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors w-full group">
                                <Checkbox checked={permits.includes(item.id)} onCheckedChange={() => toggleItem(permits, setPermits, item.id)} />
                                <span className="text-[11px] font-bold text-slate-700 uppercase leading-tight group-hover:text-slate-900 transition-colors">{item.label}</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1.5 mt-3">
                            <Label className="text-[10px] font-black uppercase text-slate-400">Others: Input Details</Label>
                            <Textarea 
                              className="min-h-[80px] rounded-xl text-[11px] font-bold uppercase w-full focus:ring-2 focus:ring-slate-900/10 transition-all" 
                              placeholder="List other documents here..."
                              value={formData.otherDocuments} 
                              onChange={e => setFormData({...formData, otherDocuments: e.target.value})} 
                            />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400">Working Days</Label>
                            <div className="flex flex-wrap gap-2 w-full">
                              {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(day => (
                                <button key={day} onClick={() => toggleItem(workingDays, setWorkingDays, day)} className={`size-9 rounded-lg text-[10px] font-black border-2 transition-all ${workingDays.includes(day) ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400">Time Range</Label>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-[9px] font-bold uppercase text-slate-500">From</Label>
                                <Input 
                                  type="datetime-local" 
                                  className="h-11 rounded-xl text-[12px] w-full focus:ring-2 focus:ring-slate-900/10 transition-all" 
                                  value={formData.workingTimeFrom} 
                                  onChange={e => setFormData({...formData, workingTimeFrom: e.target.value})} 
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[9px] font-bold uppercase text-slate-500">To</Label>
                                <Input 
                                  type="datetime-local" 
                                  className="h-11 rounded-xl text-[12px] w-full focus:ring-2 focus:ring-slate-900/10 transition-all" 
                                  value={formData.workingTimeTo} 
                                  onChange={e => setFormData({...formData, workingTimeTo: e.target.value})} 
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>

                <div className="p-4 border-t border-slate-100 flex justify-between bg-slate-50/30 shrink-0 items-center">
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" disabled={currentStep === 1} onClick={() => setCurrentStep(prev => prev - 1)} className="h-11 px-6 font-black uppercase text-[10px]">Back</Button>
                    <span className="hidden md:block text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      Press <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white">Ctrl + Enter</kbd> to proceed
                    </span>
                  </div>
                  {currentStep < 3 ? (
                    <Button 
                      onClick={() => {
                        if (currentStep === 2) {
                          if (!formData.projectTitle?.trim() || !formData.location?.trim() || !formData.agentName?.trim() || !formData.projectName?.trim() || !formData.scopeOfWork?.trim()) {
                            return toast.error("Please fill in Project Title, Location, Agent Name, Project Name, and Scope of Work.");
                          }
                        }
                        setCurrentStep(prev => prev + 1);
                      }} 
                      className="h-11 px-8 bg-slate-900 text-white font-black uppercase text-[10px] shadow-lg shadow-slate-200 hover:shadow-xl transition-all"
                    >
                      Next Step
                    </Button>
                  ) : (
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="h-11 px-8 bg-emerald-600 text-white font-black uppercase text-[10px] shadow-lg shadow-emerald-100 hover:shadow-xl transition-all">
                      {isSubmitting ? <Loader2 className="animate-spin" /> : <><Send size={14} className="mr-2" /> Submit Request</>}
                    </Button>
                  )}
                </div>
              </Card>
            </div>

            {/* SIDEBAR PHOTO SECTION */}
            <div className="lg:col-span-4 flex flex-col min-h-0 space-y-3 overflow-y-auto pr-1">
              <Card className="bg-slate-900 text-white rounded-[1.5rem] p-4 shadow-xl overflow-hidden relative border-none shrink-0">
                <div className="relative z-10">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-emerald-400"/> Live Summary
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Project Title</p>
                      <p className="text-[13px] font-bold truncate">{formData.projectTitle || "Not specified"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Location</p>
                      <p className="text-[13px] font-bold truncate">{formData.location || "Not specified"}</p>
                    </div>
                    {!userDetails?.referenceid && (
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Agent Name</p>
                        <p className="text-[13px] font-bold truncate">{formData.agentName || "Not specified"}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Project & Priority</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold truncate flex-1">{formData.projectName || "Untitled Request"}</p>
                        <span className={`px-2 py-0.5 rounded-[4px] text-[8px] font-black ${formData.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' : formData.priority === 'MEDIUM' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {formData.priority}
                        </span>
                      </div>
                    </div>

                    {(siteInstallation.length > 0 || inHouse.length > 0) && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Selected Services</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[...siteInstallation, ...inHouse].map(item => (
                            <span key={item} className="px-1.5 py-0.5 bg-slate-800 rounded text-[8px] font-bold text-slate-300 ring-1 ring-white/10 hover:bg-slate-700 transition-colors">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/5 mt-2 flex items-center justify-between">
                      <div className="flex flex-col">
                        <p className="text-[7px] font-black text-slate-500 uppercase">Step Progress</p>
                        <p className="text-[10px] font-bold text-emerald-400">{Math.round((currentStep/3)*100)}% Complete</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={clearDraft}
                        className="h-6 px-2 text-[8px] font-black uppercase text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      >
                        Reset Form
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-white border border-slate-200 rounded-[1.5rem] shadow-sm">
                <Label className="text-[11px] font-black uppercase text-slate-400 flex items-center gap-1.5 mb-4">
                  <Camera size={12}/> Site Photos ({files.length})
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {files.map((file, idx) => (
                    <div key={idx} className="aspect-square rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden relative group">
                      <img src={URL.createObjectURL(file)} className="object-cover w-full h-full" alt="preview" />
                      <button onClick={() => setFiles(files.filter((_, i) => i !== idx))} className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-lg bg-slate-50 border border-slate-100 border-dashed flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                    <Plus size={14} className="text-slate-300" />
                    <input type="file" multiple className="hidden" accept="image/png, image/jpeg, image/jpg, image/webp, image/gif" onChange={handleFileChange} />
                  </label>
                </div>
              </Card>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Map Picker Dialog */}
      {isMounted && (
        <Dialog open={showMapPicker} onOpenChange={setShowMapPicker}>
          <DialogContent className="max-w-3xl max-h-[80vh] p-0" showCloseButton={false}>
            <DialogHeader className="p-4 border-b border-slate-200 flex flex-row items-center justify-between">
              <DialogTitle className="text-[12px] font-black uppercase tracking-wider">Select Location on Map</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMapPicker(false)}
                className="h-8 w-8 p-0"
              >
                <X size={14} />
              </Button>
            </DialogHeader>
            <div className="p-4 h-[500px]">
              <MapPicker
                onLocationSelect={(lat: number, lng: number, address: string) => {
                  setFormData(prev => ({
                    ...prev,
                    location: address,
                    locationCoordinates: { lat, lng }
                  }));
                  setSelectedCoordinates({ lat, lng });
                  setShowMapPicker(false);
                }}
                initialPosition={selectedCoordinates || { lat: 14.5995, lng: 120.9842 }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </ProtectedPageWrapper>
  );
}
