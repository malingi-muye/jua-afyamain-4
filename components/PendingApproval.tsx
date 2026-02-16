import React from 'react';
import { Clock, LogOut, CheckCircle, ShieldCheck } from 'lucide-react';

interface PendingApprovalProps {
    clinicName?: string;
    onLogout: () => void;
}

const PendingApproval: React.FC<PendingApprovalProps> = ({ clinicName, onLogout }) => {
    return (
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-600/20 blur-[120px] rounded-full animate-pulse delay-700" />

            <div className="max-w-md w-full relative z-10">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-700">
                    <div className="relative p-10 flex flex-col items-center">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
                            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-500">
                                <Clock className="w-12 h-12 text-white" />
                            </div>
                        </div>

                        <h2 className="text-3xl font-extrabold text-white text-center tracking-tight">
                            Reviewing Your <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400">Application</span>
                        </h2>

                        {clinicName && (
                            <div className="mt-4 px-5 py-1.5 bg-white/5 border border-white/10 rounded-full">
                                <span className="text-blue-300 font-semibold text-sm tracking-wide uppercase">{clinicName}</span>
                            </div>
                        )}

                        <div className="mt-10 w-full space-y-4">
                            <div className="group flex items-center gap-5 p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-blue-500/30 transition-all duration-300">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">Identity Verified</h3>
                                    <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">Your professional credentials were accepted.</p>
                                </div>
                            </div>

                            <div className="group flex items-center gap-5 p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/30 transition-all duration-300">
                                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">Compliance Review</h3>
                                    <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">We're verifying your clinic's regulatory status.</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 w-full grid grid-cols-1 gap-4">
                            <button
                                onClick={onLogout}
                                className="group relative flex items-center justify-center gap-3 py-4 bg-white text-slate-900 font-bold rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <LogOut className="relative w-5 h-5 transition-transform group-hover:-translate-x-1" />
                                <span className="relative">Sign Out</span>
                            </button>

                            <p className="text-center text-slate-500 text-xs font-medium">
                                Usually takes 12-24 hours. Need faster access? <br />
                                <a href="mailto:priority@juaafya.com" className="text-blue-400 hover:text-blue-300 underline underline-offset-4 mt-1 inline-block">Request Priority Review</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PendingApproval;
