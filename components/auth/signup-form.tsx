"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, ShieldCheck, ShieldAlert, Eye, EyeOff } from "lucide-react"
import { validation } from "@/lib/validation"
import { authService } from "@/services/authService"

export function SignupForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [clinicName, setClinicName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [honeypot, setHoneypot] = useState("")

  const [searchParams] = useSearchParams()
  const invitationId = searchParams.get("invitation")
  const [invitationInfo, setInvitationInfo] = useState<{ clinicName: string, email: string } | null>(null)

  useEffect(() => {
    async function loadInvitation() {
      if (!invitationId) return

      try {
        const { data, error } = await supabase.rpc('get_invitation_details', {
          p_invitation_id: invitationId
        })

        if (error) throw error
        if (data && data.length > 0) {
          const info = data[0]
          setInvitationInfo({ clinicName: info.clinic_name, email: info.invited_email })
          setClinicName(info.clinic_name)
          setEmail(info.invited_email)
        }
      } catch (err) {
        console.error("Failed to load invitation:", err)
      }
    }
    loadInvitation()
  }, [invitationId])

  const passwordFeedback = useMemo(() => validation.getPasswordStrengthFeedback(password), [password])

  const passwordRequirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /[0-9]/.test(password) },
    { label: "One special character", met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Antispam Honeypot - If this hidden field is filled, it's a bot
    if (honeypot) {
      console.warn("Honeypot filled - blocking bot submission")
      navigate("/auth/login?message=Account created successfully. Please login.")
      return
    }

    // Validate email
    if (!validation.isValidEmail(email)) {
      setError("Please enter a valid email address")
      return
    }

    // Validate password requirements
    if (!validation.isStrongPassword(password)) {
      setError("Password does not meet all security requirements")
      return
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      await authService.signup(email, password, fullName, clinicName)

      // Redirect to login
      navigate("/auth/login?message=Account created successfully. Please login.")
    } catch (err: any) {
      console.error("Signup error details:", err)

      // Extract custom error message from database exception if possible
      let errorMessage = "An error occurred. Please try again."

      if (err.message) {
        if (err.message.includes("CLINIC_ALREADY_EXISTS")) {
          errorMessage = err.message.split("CLINIC_ALREADY_EXISTS:")[1].trim()
        } else if (err.message.includes("User already registered") || err.message.includes("already exists")) {
          errorMessage = "This email is already registered."
        } else {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const getStrengthColor = () => {
    if (!password) return "bg-muted"
    switch (passwordFeedback.score) {
      case 'weak': return "bg-red-500"
      case 'fair': return "bg-amber-500"
      case 'good': return "bg-blue-500"
      case 'strong': return "bg-emerald-500"
      default: return "bg-muted"
    }
  }

  return (
    <Card className="border-none shadow-2xl bg-card/60 backdrop-blur-md overflow-hidden">
      <div className="h-1.5 w-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getStrengthColor()}`}
          style={{ width: password ? `${(passwordRequirements.filter(r => r.met).length / 5) * 100}%` : "0%" }}
        />
      </div>
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Create Clinic Account</CardTitle>
        <CardDescription className="text-center">Sign up to start using JuaAfya</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Honeypot field - Visually hidden, bots will fill it */}
          <div className="opacity-0 absolute -z-10 pointer-events-none h-0 w-0 overflow-hidden" aria-hidden="true">
            <Input
              type="text"
              name="subject_verification"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Full Name</label>
            <Input
              placeholder="Dr. John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isLoading}
              className="bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all"
            />
          </div>

          {!invitationInfo && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Clinic Name</label>
              <Input
                placeholder="JuaAfya Health Center"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                disabled={isLoading}
                className="bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all"
              />
              <p className="text-[10px] text-muted-foreground italic">
                * Required for clinic registration. Skip if joining via invitation.
              </p>
            </div>
          )}

          {invitationInfo && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-sm text-center">
                You've been invited to join <span className="font-bold text-primary">{invitationInfo.clinicName}</span>.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Email Address</label>
            <Input
              type="email"
              placeholder="name@clinic.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || !!invitationInfo}
              className="bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-foreground/80">Password</label>
              {password && (
                <span className={`text-[10px] font-bold uppercase tracking-wider ${passwordFeedback.score === 'weak' ? 'text-red-500' :
                  passwordFeedback.score === 'fair' ? 'text-amber-500' :
                    passwordFeedback.score === 'good' ? 'text-blue-500' : 'text-emerald-500'
                  }`}>
                  {passwordFeedback.score}
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 p-3 rounded-lg bg-muted/30 border border-muted-foreground/5">
              {passwordRequirements.map((req, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] transition-colors">
                  {req.met ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30" />
                  )}
                  <span className={req.met ? "text-foreground/70" : "text-muted-foreground"}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Confirm Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              className="bg-background/50 border-muted-foreground/20 focus:border-primary/50 transition-all"
            />
          </div>

          <Button type="submit" className="w-full h-11 text-base font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] bg-primary hover:bg-primary/90 mt-2" disabled={isLoading}>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                <span>Creating account...</span>
              </div>
            ) : "Create Account"}
          </Button>

          <div className="text-center text-sm pt-2">
            <span className="text-muted-foreground">Already have an account? </span>
            <a href="/auth/login" className="text-primary font-bold hover:underline">
              Login
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
