"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Plus, Send, Loader2, X, Ruler, Camera, 
  Monitor, Layers, Activity, RefreshCcw, CheckCircle2,
  ClipboardCheck 
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sendNotificationToHierarchy, NotificationTemplates } from "@/lib/notification-service";

// Database
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit } from "firebase/firestore";

export default function DialuxRequestWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  // MONITORING STATE
  interface QueueItem {
    id: string;
    projectName: string;
    status: string;
    workingDays?: string;
    dateRange?: string;
  }
  
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState({ total: 0, inProgress: 0, pending: 0 });

  // FILES (Stored as local File objects before upload)
  const [plottingFiles, setPlottingFiles] = useState<File[]>([]); 
  const [refPhotos, setRefPhotos] = useState<File[]>([]); 

  // FORM STATES
  const [formData, setFormData] = useState({
    clientName: "",
    siteAddress: "",
    projectName: "",
    projectType: "", 
    projectTypeOther: "",
    mountingHeight: "", 
    fixtureDetails: "", 
    fixtureDetailsOther: "",
    lightingRequirement: "", 
    preferredLux: "", 
    otherInstructions: "", 
  });

  useEffect(() => {
    const storedId = typeof window !== 'undefined' ? localStorage.getItem("userId") : null;
    setUserId(storedId);

    const q = query(collection(db, "dialux_requests"), orderBy("createdAt", "desc"), limit(6));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QueueItem[];
      setQueue(docs);
      setStats({
        total: docs.length,
        inProgress: docs.filter((d) => d.status === "ON GOING").length,
        pending: docs.filter((d) => d.status === "PENDING" || d.status === "ON QUEUE").length
      });
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'plotting' | 'photo') => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (type === 'plotting') setPlottingFiles(prev => [...prev, ...newFiles]);
      else setRefPhotos(prev => [...prev, ...newFiles]);
    }
  };

  // Helper to render file previews
  const renderFilePreview = (file: File, index: number, type: 'plotting' | 'photo') => {
    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : null;

    return (
      <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        {isImage ? (
          <img src={previewUrl!} alt="preview" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-slate-100 p-2 text-center">
            <Layers size={20} className="text-slate-400 mb-1" />
            <span className="text-[8px] font-bold text-slate-500 truncate w-full px-1">{file.name}</span>
          </div>
        )}
        <button 
          onClick={() => {
            if (type === 'plotting') setPlottingFiles(plottingFiles.filter((_, i) => i !== index));
            else setRefPhotos(refPhotos.filter((_, i) => i !== index));
          }}
          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X size={12} />
        </button>
      </div>
    );
  };

  // --- CLOUDINARY UPLOAD LOGIC ---
  const handleDirectUpload = async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "Xchire"); 

    try {
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

  const validateStep = () => {
    if (currentStep === 1) {
      if (!formData.clientName || !formData.siteAddress || !formData.projectName || !formData.projectType) {
        return toast.error("Please fill in all project information.");
      }
      if (formData.projectType === "Other" && !formData.projectTypeOther) {
        return toast.error("Please specify the project type.");
      }
    }
    if (currentStep === 2) {
      if (plottingFiles.length === 0) return toast.error("Floor plan/plotting files are required.");
    }
    if (currentStep === 3) {
      if (!formData.mountingHeight) return toast.error("Mounting height is required.");
      if (!formData.fixtureDetails) return toast.error("Fixture details are required.");
      if (formData.fixtureDetails === "Other" && !formData.fixtureDetailsOther) {
        return toast.error("Please specify the fixture details.");
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleSubmit = async () => {
    if (!formData.lightingRequirement) return toast.error("Please select a Lighting Standard.");
    setIsSubmitting(true);
    const toastId = toast.loading("Syncing with engiconnect...");

    try {
      const allFiles = [...plottingFiles, ...refPhotos];
      let uploadedUrls: string[] = [];

      if (allFiles.length > 0) {
        toast.loading(`Uploading ${allFiles.length} files to Cloudinary...`, { id: toastId });
        const uploadPromises = allFiles.map(file => handleDirectUpload(file));
        const results = await Promise.all(uploadPromises);
        uploadedUrls = results.filter((url): url is string => url !== null);
        
        if (uploadedUrls.length === 0 && allFiles.length > 0) {
           throw new Error("File upload failed. Please check your connection.");
        }
      }

      await addDoc(collection(db, "dialux_requests"), {
        ...formData,
        attachments: uploadedUrls,
        status: "PENDING",
        createdAt: serverTimestamp(),
        createdBy: userId,
      });

      toast.success("Request submitted successfully!", { id: toastId });

      // Send push notification to hierarchy (user's TSM/Manager + admins)
      if (userId) {
        const userName = localStorage.getItem("userName") || "A client";
        const notifResult = await sendNotificationToHierarchy(
          NotificationTemplates.dialux.created(userName, formData.projectName),
          userId,
          { triggeredBy: userId }
        );
        if (notifResult.success) {
          console.log(`Push notification: ${notifResult.message}`);
        }
      }

      router.push("/request/dialux");
    } catch (e: any) {
      console.error("Submission Error:", e);
      toast.error(e.message || "Error submitting request.", { id: toastId });
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-10">
      <PageHeader title="DIALux Simulation" version="V2.8" showBackButton={true} />
      
      <main className="p-4 md:p-8 max-w-[1450px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: MULTI-STEP FORM */}
        <div className="lg:col-span-12 space-y-12">
          <div className="flex justify-between items-center px-4">
             {["General", "Files", "Technical", "Standard"].map((label, idx) => (
                <div key={label} className="flex flex-col items-center gap-2">
                   <div className={cn(
                     "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all",
                     currentStep > idx + 1 ? "bg-emerald-500 border-emerald-500 text-white" : 
                     currentStep === idx + 1 ? "bg-slate-900 border-slate-900 text-white shadow-lg scale-110" : "bg-white border-slate-200 text-slate-400"
                   )}>
                     {currentStep > idx + 1 ? <CheckCircle2 size={14}/> : idx + 1}
                   </div>
                   <span className={cn("text-[9px] font-black uppercase tracking-widest", currentStep === idx + 1 ? "text-slate-900" : "text-slate-400")}>{label}</span>
                </div>
             ))}
          </div>

          <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white py-6 px-10">
              <div className="flex justify-between items-center">
                <CardTitle className="text-[12px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
                  <Activity size={18} className="text-emerald-400"/> Engineering Request
                </CardTitle>
                <span className="text-[10px] bg-white/10 px-3 py-1 rounded-full font-mono">STEP 0{currentStep}</span>
              </div>
            </CardHeader>

            <CardContent className="p-10">
              {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Client's Name</Label>
                      <Input className="h-12 rounded-2xl border-slate-100 bg-slate-50/50 font-bold" placeholder="Enter Client Name" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Project Name</Label>
                      <Input className="h-12 rounded-2xl border-slate-100 bg-slate-50/50 font-bold" placeholder="e.g. Warehouse Expansion" value={formData.projectName} onChange={e => setFormData({...formData, projectName: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Site Address</Label>
                    <Input className="h-12 rounded-2xl border-slate-100 bg-slate-50/50" placeholder="Full Project Location" value={formData.siteAddress} onChange={e => setFormData({...formData, siteAddress: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Project Type</Label>
                    <select className="w-full h-12 px-4 rounded-2xl bg-slate-50/50 border border-slate-100 text-sm font-bold outline-none" value={formData.projectType} onChange={e => setFormData({...formData, projectType: e.target.value})}>
                        <option value="">Select Category...</option>
                        {["New Building", "Retrofitting", "Renovation", "Bidding", "Other"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    {formData.projectType === "Other" && (
                      <Input className="mt-3 h-12 rounded-2xl border-blue-100 bg-blue-50/30 font-bold animate-in zoom-in-95" placeholder="Specify project type (e.g., Industrial Site)" value={formData.projectTypeOther} onChange={e => setFormData({...formData, projectTypeOther: e.target.value})} />
                    )}
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50 text-center space-y-4">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-slate-400"><Layers size={24}/></div>
                    <h4 className="text-[11px] font-black uppercase tracking-wider">Area Dimension / Floor Plan</h4>
                    
                    {/* PLOTTING FILES PREVIEW */}
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3 max-w-lg mx-auto">
                      {plottingFiles.map((f, i) => renderFilePreview(f, i, 'plotting'))}
                    </div>

                    <Button asChild variant="outline" className="rounded-full px-8 bg-white border-slate-200 hover:bg-slate-900 hover:text-white transition-all">
                        <label htmlFor="plotting-upload" className="cursor-pointer font-black text-[10px] uppercase tracking-widest"><Plus className="mr-2" size={14}/> Attach File</label>
                    </Button>
                    <input id="plotting-upload" type="file" multiple className="hidden" onChange={e => handleFileUpload(e, 'plotting')} />
                  </div>

                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50 text-center space-y-4">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-slate-400"><Camera size={24}/></div>
                    <h4 className="text-[11px] font-black uppercase tracking-wider">Reference Photos <span className="text-[9px] text-slate-400 lowercase italic font-medium">(optional)</span></h4>
                    
                    {/* PHOTO PREVIEW */}
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3 max-w-lg mx-auto">
                      {refPhotos.map((f, i) => renderFilePreview(f, i, 'photo'))}
                    </div>

                    <Button asChild variant="outline" className="rounded-full px-8 bg-white border-slate-200 hover:bg-slate-900 hover:text-white transition-all">
                        <label htmlFor="photo-upload" className="cursor-pointer font-black text-[10px] uppercase tracking-widest"><Plus className="mr-2" size={14}/> Attach Photos</label>
                    </Button>
                    <input id="photo-upload" type="file" multiple className="hidden" onChange={e => handleFileUpload(e, 'photo')} />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 flex items-center gap-2"><Ruler size={14}/> Target Mounting Height</Label>
                      <Input type="text" className="h-12 rounded-2xl border-slate-100 bg-slate-50/50 font-bold" placeholder="e.g. 4.5 Meters" value={formData.mountingHeight} onChange={e => setFormData({...formData, mountingHeight: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fixture Details</Label>
                      <select className="w-full h-12 px-4 rounded-2xl bg-slate-50/50 border border-slate-100 text-sm font-bold outline-none" value={formData.fixtureDetails} onChange={e => setFormData({...formData, fixtureDetails: e.target.value})}>
                          <option value="">Select Option...</option>
                          <option value="Engineering Recommendation">Engineering Recommendation</option>
                          <option value="Other">Other (Specify Brand/Model)</option>
                      </select>
                    </div>
                  </div>
                  {formData.fixtureDetails === "Other" && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Specify Fixture</Label>
                      <Input className="h-12 rounded-2xl border-blue-100 bg-blue-50/30 font-bold" placeholder="Enter Brand, Model, or Wattage" value={formData.fixtureDetailsOther} onChange={e => setFormData({...formData, fixtureDetailsOther: e.target.value})} />
                    </div>
                  )}
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Lighting Requirement</Label>
                      <select className="w-full h-12 px-4 rounded-2xl bg-slate-50/50 border border-slate-100 text-sm font-bold outline-none" value={formData.lightingRequirement} onChange={e => setFormData({...formData, lightingRequirement: e.target.value})}>
                          <option value="">Select Standard...</option>
                          <option value="DOLE-OSH">DOLE-OSH (Philippines)</option>
                          <option value="DOE">DOE Standard</option>
                          <option value="CIBSE">CIBSE Standard</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Preferred Lux Level</Label>
                      <Input type="text" className="h-12 rounded-2xl border-slate-100 bg-slate-50/50 font-bold" placeholder="e.g. 500 Lux" value={formData.preferredLux} onChange={e => setFormData({...formData, preferredLux: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Other Instructions</Label>
                    <Textarea className="rounded-[1.5rem] border-slate-100 bg-slate-50/50 min-h-[120px] p-4 font-medium" placeholder="Additional details or specific areas to focus on..." value={formData.otherInstructions} onChange={e => setFormData({...formData, otherInstructions: e.target.value})} />
                  </div>
                </div>
              )}
            </CardContent>

            <div className="p-8 border-t flex justify-between items-center bg-slate-50/50">
                <Button variant="ghost" disabled={currentStep === 1} onClick={() => setCurrentStep(v => v - 1)} className="text-[10px] font-black uppercase tracking-widest px-8">Back</Button>
                {currentStep < 4 ? (
                    <Button className="bg-slate-900 hover:bg-black rounded-2xl px-12 h-12 text-[10px] font-black uppercase tracking-widest shadow-xl" onClick={validateStep}>Next Step</Button>
                ) : (
                    <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-2xl px-12 h-12 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-200" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <><Send size={14} className="mr-2"/> Submit Request</>}
                    </Button>
                )}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: MONITORING TABLE */}
        {/* <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white min-h-[500px]">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 bg-slate-50/50 p-6 px-8">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-500">
                <Monitor size={16} className="text-blue-600" /> DIALux Monitoring
              </CardTitle>
              <RefreshCcw size={14} className="text-slate-300 animate-hover cursor-pointer" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="p-5 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">Project / ID</th>
                      <th className="p-5 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">Timeline</th>
                      <th className="p-5 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.length > 0 ? queue.map((req, i) => (
                      <tr key={req.id} className="group hover:bg-blue-50/30 transition-colors border-b border-slate-50 last:border-none">
                        <td className="p-5">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-mono text-slate-300">#DSRF-00{i+1}</span>
                            <span className="text-[11px] font-black text-slate-700 uppercase truncate max-w-[120px]">{req.projectName}</span>
                          </div>
                        </td>
                        <td className="p-5">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-600">2 Working Days</span>
                            <span className="text-[9px] text-slate-400 font-medium">Est. Processing</span>
                          </div>
                        </td>
                        <td className="p-5 text-right">
                          <span className={cn(
                            "text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider",
                            req.status === "ON GOING" ? "text-blue-600 bg-blue-100/50" : 
                            req.status === "COMPLETED" ? "text-emerald-600 bg-emerald-100/50" :
                            "text-amber-600 bg-amber-100/50"
                          )}>
                            {req.status || 'QUEUED'}
                          </span>
                        </td>
                      </tr>
                    )) : (
                        <tr><td colSpan={3} className="p-20 text-center opacity-30"><Activity size={40} className="mx-auto mb-2"/><p className="text-[10px] font-black uppercase">No active requests</p></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="p-8 grid grid-cols-2 gap-6 bg-slate-50/50 border-t border-slate-100">
                 <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">In Progress</p>
                    <p className="text-2xl font-black text-blue-600">{stats.inProgress}</p>
                 </div>
                 <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Queue</p>
                    <p className="text-2xl font-black text-amber-500">{stats.pending}</p>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="p-8 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl border-none relative overflow-hidden group">
            <div className="absolute top-[-20px] right-[-20px] opacity-10 group-hover:rotate-12 transition-transform duration-500"><ClipboardCheck size={120}/></div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400"/> Live Summary
            </h4>
            <div className="grid grid-cols-2 gap-8 relative z-10">
                <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Client</p>
                    <p className="text-sm font-bold truncate text-slate-200">{formData.clientName || "---"}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Type</p>
                    <p className="text-sm font-bold text-slate-200">{formData.projectType === "Other" ? formData.projectTypeOther : formData.projectType || "---"}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Height</p>
                    <p className="text-sm font-bold text-slate-200">{formData.mountingHeight || "---"}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Standard</p>
                    <p className="text-sm font-bold text-emerald-400">{formData.lightingRequirement || "---"}</p>
                </div>
            </div>
          </Card>
        </div> */}
      </main>
    </div>
  );
}