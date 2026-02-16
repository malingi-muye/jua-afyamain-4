import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamMember, ClinicSettings } from '../types/index';
import { Lock, Mail, ChevronRight, Activity, Eye, EyeOff, Globe, Phone, ShieldCheck, User, Zap, Building2, ArrowRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { validation } from '../lib/validation';
import { useEnterpriseAuth } from '../hooks/useEnterpriseAuth';
import useStore from '../store';
import { SYSTEM_ADMIN } from '../lib/config';
import { getDefaultViewForRole } from '../lib/rbac';
import { NEW_ROLE_MAP } from '../types/enterprise';
import logger from '../lib/logger';

interface LoginProps {
    onLogin?: (user: TeamMember) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const navigate = useNavigate();
    const { signIn, signUp: enterpriseSignUp, resetPassword, user, organization, isLoading: authLoading, error: authError } = useEnterpriseAuth();
    const settings = useStore(state => state.settings);
    const actions = useStore(state => state.actions);
    const team = settings.team;
    const systemAdmin = SYSTEM_ADMIN;
    const [isSignUp, setIsSignUp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isPendingApproval, setIsPendingApproval] = useState(false);
    const [isResetPassword, setIsResetPassword] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);

    // Login Form State
    const [loginForm, setLoginForm] = useState({
        email: '',
        password: ''
    });

    // Sign Up Form State
    const [signUpForm, setSignUpForm] = useState({
        clinicName: '',
        fullName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    // Reset Password Form State
    const [resetForm, setResetForm] = useState({
        email: ''
    });

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // Input validation
            if (!loginForm.email || !loginForm.password) {
                throw new Error('Email and password are required');
            }

            if (!validation.isValidEmail(loginForm.email)) {
                throw new Error('Invalid email format');
            }

            logger.log('[Login] Starting signin for:', loginForm.email);
            // Use enterprise auth
            const result = await signIn(loginForm.email, loginForm.password);

            logger.log('[Login] Signin result:', result);
            if (!result.success) {
                throw new Error(result.error || 'Invalid email or password');
            }

            logger.log('[Login] Signin successful, navigating to dashboard');
            // Navigate to dashboard - AppLayout will handle auth loading
            // The auth state listener will fetch user data asynchronously
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Invalid email or password. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignUpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate all required fields
        if (!signUpForm.email || !signUpForm.fullName || !signUpForm.clinicName) {
            setError('All fields are required');
            return;
        }

        if (!validation.isValidEmail(signUpForm.email)) {
            setError('Invalid email format');
            return;
        }

        if (signUpForm.password !== signUpForm.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!validation.isStrongPassword(signUpForm.password)) {
            const feedback = validation.getPasswordStrengthFeedback(signUpForm.password);
            setError(`Password requirements: ${feedback.feedback.join(', ')}`);
            return;
        }

        setIsLoading(true);

        try {
            const result = await enterpriseSignUp(
                signUpForm.email,
                signUpForm.password,
                {
                    full_name: signUpForm.fullName,
                    clinic_name: signUpForm.clinicName,
                    role: 'admin' // Default role for new signups
                }
            );

            if (!result.success) {
                throw new Error(result.error || 'Sign up failed');
            }

            // If session exists, user is auto-confirmed (Email Verify Disabled)
            if (result.session) {
                logger.log('[Login] Auto-confirm detected. Session active.');
                // Even if auto-confirmed, if this is a NEW clinic signup, they effectively need to wait 
                // for the Super Admin to approve the 'pending' clinic.
                // We show the success message regardless.
            }

            setIsPendingApproval(true);
        } catch (err: any) {
            setError(err.message || 'Sign up failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate email
        if (!resetForm.email || !validation.isValidEmail(resetForm.email)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsLoading(true);

        try {
            const result = await resetPassword(resetForm.email);
            if (!result.success) {
                throw new Error(result.error || 'Failed to send reset email');
            }
            setResetEmailSent(true);
        } catch (err: any) {
            setError(err.message || 'Failed to send reset email. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Memoized static visual component to prevent re-renders during form input
    const LoginVisualMockup = React.memo(() => {
        return (
            <div className="relative z-10 w-[320px] h-[600px] bg-brand-dark rounded-[3rem] border-[8px] border-[#252b3b] shadow-2xl rotate-[-8deg] translate-y-16 hover:rotate-0 transition-transform duration-700 ease-out hidden md:block">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-7 w-36 bg-[#252b3b] rounded-b-2xl z-20"></div>
                <div className="w-full h-full bg-brand-dark rounded-[2.5rem] overflow-hidden flex flex-col pt-12 px-5 pb-6">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-400 font-medium">Total Revenue</span>
                            <span className="text-3xl font-bold text-white tracking-tight">897.00 <span className="text-brand-yellow text-sm">KSh</span></span>
                        </div>
                        <div className="w-10 h-10 bg-[#1e2532] rounded-full flex items-center justify-center border border-white/5">
                            <Activity className="w-5 h-5 text-brand-blue" />
                        </div>
                    </div>
                    <div className="h-40 flex items-end justify-between gap-3 mb-8 px-1">
                        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                            <div key={i} className={`w-full rounded-t-lg opacity-90 ${i === 5 ? 'bg-brand-yellow' : 'bg-brand-blue'}`} style={{ height: `${h}%`, opacity: i === 5 ? 1 : 0.6 }}></div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-[#1e2532] p-4 rounded-3xl border border-white/5">
                            <div className="text-xs text-slate-400 mb-2 font-medium">Patients</div>
                            <div className="h-20 flex items-end">
                                <div className="text-xl font-bold text-white">1,204</div>
                            </div>
                        </div>
                        <div className="bg-[#1e2532] p-4 rounded-3xl border border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-brand-blue blur-[40px] opacity-20"></div>
                            <div className="text-xs text-slate-400 mb-2 font-medium">Growth</div>
                            <div className="h-20 flex items-end">
                                <div className="text-xl font-bold text-white">24%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    });
    LoginVisualMockup.displayName = 'LoginVisualMockup';



    return (
        <div className="min-h-screen bg-brand-cream/50 dark:bg-brand-dark flex items-center justify-center p-4 md:p-8 font-sans">
            <div className="w-full max-w-[1400px] bg-white dark:bg-[#1A1F2B] rounded-[2.5rem] shadow-2xl shadow-brand-dark/10 overflow-hidden flex flex-col lg:flex-row min-h-0 lg:min-h-[800px]">

                {/* LEFT SIDE - Brand & Visual */}
                <div className="lg:w-1/2 bg-brand-dark relative overflow-hidden flex flex-col justify-center items-center p-8 md:p-12 text-white min-h-[300px] lg:min-h-auto">
                    <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
                        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-blue rounded-full blur-[160px] opacity-40"></div>
                        <div className="absolute bottom-[10%] right-[-10%] w-[400px] h-[400px] bg-brand-teal rounded-full blur-[128px] opacity-30"></div>
                    </div>

                    <div className="relative z-10 text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-6">
                            <span className="w-2 h-2 rounded-full bg-brand-yellow"></span>
                            <span className="text-[10px] font-bold tracking-widest uppercase text-brand-yellow">Enterprise Edition</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold leading-[1.1] mb-6 tracking-tight">
                            Manage your <br />
                            <span className="text-brand-blue">clinic growth.</span>
                        </h1>
                        <p className="text-slate-400 text-lg max-w-md mx-auto leading-relaxed">
                            Secure, scalable, and simple. Powered by Supabase.
                        </p>
                    </div>

                    {/* CSS Phone Mockup */}
                    <LoginVisualMockup />
                </div>

                {/* RIGHT SIDE - Form */}
                <div className="lg:w-1/2 bg-white dark:bg-[#1A1F2B] flex flex-col p-6 md:p-12 lg:p-20 relative justify-center overflow-y-auto">

                    <div className="max-w-md w-full mx-auto">
                        {isPendingApproval ? (
                            <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200 dark:shadow-none">
                                    <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                                </div>
                                <h2 className="text-3xl font-bold text-brand-dark dark:text-white mb-4">Check Your Email</h2>
                                <div className="p-6 bg-slate-50 dark:bg-[#121721] rounded-3xl border border-slate-100 dark:border-slate-800 mb-8 w-full">
                                    <p className="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed text-sm">
                                        We've sent a confirmation link to <span className="font-bold text-brand-dark dark:text-white">{signUpForm.email}</span>.
                                    </p>
                                    <div className="flex items-start gap-3 text-left bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl">
                                        <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            Please verify your email to access your JuaAfya account.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setIsPendingApproval(false); setIsSignUp(false); setSignUpForm({ ...signUpForm, password: '', confirmPassword: '' }); }}
                                    className="w-full py-4 bg-brand-dark dark:bg-white hover:opacity-90 text-white dark:text-brand-dark font-bold rounded-full shadow-xl transition-all flex items-center justify-center gap-2"
                                >
                                    Return to Sign In
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-8">
                                    <div className="flex items-center gap-3 hidden lg:flex">
                                        <div className="w-10 h-10 flex items-center justify-center">
                                            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                                                <path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M6.34 17.66L4.93 19.07M19.07 4.93L17.66 6.34" stroke="#EFE347" strokeWidth="2.5" strokeLinecap="round" />
                                                <circle cx="12" cy="12" r="6" fill="#3462EE" />
                                                <path d="M12 9V15M9 12H15" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        </div>
                                        <span className="text-2xl font-bold text-brand-dark dark:text-white tracking-tight">JuaAfya</span>
                                    </div>

                                    {!isResetPassword && (
                                        <button
                                            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                                            className="flex items-center gap-2 text-sm font-medium group"
                                        >
                                            <User className="w-4 h-4 text-brand-dark dark:text-white group-hover:text-brand-blue transition-colors" />
                                            <span className="text-brand-dark dark:text-white group-hover:text-brand-blue transition-colors">
                                                {isSignUp ? 'Sign In' : 'Sign Up'}
                                            </span>
                                        </button>
                                    )}
                                </div>

                                <div className="mb-8">
                                    <h2 className="text-[3rem] font-medium text-brand-dark dark:text-white mb-2 tracking-tight leading-none">
                                        {isResetPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}
                                    </h2>
                                    {isSignUp && (
                                        <p className="text-slate-500 dark:text-slate-400">Get started with a 14-day free trial.</p>
                                    )}
                                    {isResetPassword && (
                                        <p className="text-slate-500 dark:text-slate-400">Enter your email to receive a reset link.</p>
                                    )}
                                </div>

                                {isSignUp ? (
                                    <form onSubmit={handleSignUpSubmit} className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-500">
                                        <div className="space-y-2">
                                            <div className="relative group">
                                                <Building2 className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-blue transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="Clinic Name"
                                                    className="w-full pl-14 pr-6 py-5 rounded-3xl bg-white dark:bg-[#121721] border border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all text-brand-dark dark:text-white placeholder:text-slate-400 font-medium"
                                                    value={signUpForm.clinicName}
                                                    onChange={(e) => setSignUpForm({ ...signUpForm, clinicName: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="relative group">
                                                <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-blue transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="Full Name"
                                                    className="w-full pl-14 pr-6 py-5 rounded-3xl bg-white dark:bg-[#121721] border border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all text-brand-dark dark:text-white placeholder:text-slate-400 font-medium"
                                                    value={signUpForm.fullName}
                                                    onChange={(e) => setSignUpForm({ ...signUpForm, fullName: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="relative group">
                                                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-blue transition-colors" />
                                                <input
                                                    type="email"
                                                    placeholder="Email Address"
                                                    className="w-full pl-14 pr-6 py-5 rounded-3xl bg-white dark:bg-[#121721] border border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all text-brand-dark dark:text-white placeholder:text-slate-400 font-medium"
                                                    value={signUpForm.email}
                                                    onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="relative group">
                                                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-blue transition-colors" />
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Password"
                                                    className="w-full pl-14 pr-14 py-5 rounded-3xl bg-white dark:bg-[#121721] border border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all text-brand-dark dark:text-white placeholder:text-slate-400 font-medium"
                                                    value={signUpForm.password}
                                                    onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="relative group">
                                                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-blue transition-colors" />
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Confirm Password"
                                                    className="w-full pl-14 pr-6 py-5 rounded-3xl bg-white dark:bg-[#121721] border border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all text-brand-dark dark:text-white placeholder:text-slate-400 font-medium"
                                                    value={signUpForm.confirmPassword}
                                                    onChange={(e) => setSignUpForm({ ...signUpForm, confirmPassword: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {error && (
                                            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-2xl font-medium text-center border border-red-100 dark:border-red-900 flex items-center justify-center gap-2">
                                                <AlertCircle className="w-4 h-4" /> {error}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full py-5 bg-brand-blue hover:bg-blue-700 text-white font-bold rounded-full shadow-xl shadow-brand-blue/20 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none mt-2"
                                        >
                                            {isLoading ? (
                                                <Activity className="w-6 h-6 animate-spin" />
                                            ) : (
                                                <>
                                                    Create Account <ArrowRight className="w-5 h-5" />
                                                </>
                                            )}
                                        </button>
                                    </form>
                                ) : isResetPassword ? (
                                    resetEmailSent ? (
                                        <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-right-8 duration-500">
                                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200 dark:shadow-none">
                                                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                                            </div>
                                            <h3 className="text-2xl font-bold text-brand-dark dark:text-white mb-4">Check Your Email</h3>
                                            <div className="p-6 bg-slate-50 dark:bg-[#121721] rounded-3xl border border-slate-100 dark:border-slate-800 mb-8 w-full">
                                                <p className="text-slate-600 dark:text-slate-300 mb-4 leading-relaxed text-sm">
                                                    We've sent a password reset link to <span className="font-bold text-brand-dark dark:text-white">{resetForm.email}</span>.
                                                </p>
                                                <div className="flex items-start gap-3 text-left bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl">
                                                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                                        Please check your email and click the reset link to create a new password.
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setIsResetPassword(false); setResetEmailSent(false); setResetForm({ email: '' }); }}
                                                className="w-full py-4 bg-brand-dark dark:bg-white hover:opacity-90 text-white dark:text-brand-dark font-bold rounded-full shadow-xl transition-all flex items-center justify-center gap-2"
                                            >
                                                Return to Sign In
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleResetPasswordSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                                            <div className="space-y-2">
                                                <div className="relative group">
                                                    <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-blue transition-colors" />
                                                    <input
                                                        type="email"
                                                        placeholder="Email Address"
                                                        className="w-full pl-14 pr-6 py-5 rounded-3xl bg-white dark:bg-[#121721] border border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all text-brand-dark dark:text-white placeholder:text-slate-400 font-medium"
                                                        value={resetForm.email}
                                                        onChange={(e) => setResetForm({ ...resetForm, email: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            {error && (
                                                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-2xl font-medium text-center border border-red-100 dark:border-red-900 flex items-center justify-center gap-2 animate-in fade-in">
                                                    <AlertCircle className="w-4 h-4" /> {error}
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="w-full py-5 bg-brand-blue hover:bg-blue-700 text-white font-bold rounded-full shadow-xl shadow-brand-blue/20 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                                            >
                                                {isLoading ? (
                                                    <Activity className="w-6 h-6 animate-spin" />
                                                ) : (
                                                    <>
                                                        Send Reset Link <ArrowRight className="w-5 h-5" />
                                                    </>
                                                )}
                                            </button>

                                            <div className="text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => { setIsResetPassword(false); setError(''); }}
                                                    className="text-sm font-semibold text-brand-blue hover:text-brand-dark dark:hover:text-white transition-colors"
                                                >
                                                    Back to Sign In
                                                </button>
                                            </div>
                                        </form>
                                    )
                                ) : (
                                    <form onSubmit={handleLoginSubmit} className="space-y-6 animate-in fade-in slide-in-from-left-8 duration-500">
                                        <div className="space-y-2">
                                            <div className="relative group">
                                                <input
                                                    type="email"
                                                    placeholder="Email or Username"
                                                    className="w-full px-6 py-5 rounded-3xl bg-white dark:bg-[#121721] border border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all text-brand-dark dark:text-white placeholder:text-slate-400 font-medium"
                                                    value={loginForm.email}
                                                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="relative group">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Password"
                                                    className="w-full px-6 py-5 rounded-3xl bg-white dark:bg-[#121721] border border-slate-200 dark:border-slate-700 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all text-brand-dark dark:text-white placeholder:text-slate-400 font-medium"
                                                    value={loginForm.password}
                                                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-blue transition-colors"
                                                >
                                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex justify-start">
                                            <button
                                                type="button"
                                                onClick={() => { setIsResetPassword(true); setError(''); }}
                                                className="text-sm font-semibold text-brand-blue hover:text-brand-dark dark:hover:text-white transition-colors"
                                            >
                                                Forgot password?
                                            </button>
                                        </div>

                                        {error && (
                                            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-2xl font-medium text-center border border-red-100 dark:border-red-900 flex items-center justify-center gap-2 animate-in fade-in">
                                                <AlertCircle className="w-4 h-4" /> {error}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full py-5 bg-brand-blue hover:bg-blue-700 text-white font-bold rounded-full shadow-xl shadow-brand-blue/20 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                                        >
                                            {isLoading ? (
                                                <Activity className="w-6 h-6 animate-spin" />
                                            ) : (
                                                <>
                                                    <ChevronRight className="w-5 h-5" /> Sign In
                                                </>
                                            )}
                                        </button>
                                    </form>
                                )}

                                <div className="mt-16 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs font-medium text-slate-400">
                                    <div>©2025 JuaAfya Inc. | Powered by <a href="https://mobiwave.co.ke">Mobiwave</a></div>
                                    <div className="flex gap-6">
                                        <button className="hover:text-brand-dark dark:hover:text-white transition-colors">Contact Us</button>
                                        <button className="flex items-center gap-1 hover:text-brand-dark dark:hover:text-white transition-colors">
                                            English <ChevronRight className="w-3 h-3 rotate-90" />
                                        </button>
                                    </div>
                                </div>

                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
