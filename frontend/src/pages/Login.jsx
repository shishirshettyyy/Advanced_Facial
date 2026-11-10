import React, { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, Scan } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [errors, setErrors]     = useState({})

  function validate() {
    const e = {}
    if (!email.trim())    e.email    = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email'
    if (!password)        e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Invalid credentials. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-primary-900 to-primary-800 flex-col justify-between p-12 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white"
              style={{
                width:  `${(i + 1) * 120}px`,
                height: `${(i + 1) * 120}px`,
                top:    '50%',
                left:   '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
            <Scan className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">Smart Attendance</span>
        </div>

        {/* Hero text */}
        <div className="relative">
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            AI-Powered<br />Facial Recognition<br />Attendance
          </h2>
          <p className="text-primary-200 text-base leading-relaxed">
            Automate attendance tracking with real-time face detection, 
            multi-camera support, and instant analytics.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-6">
            {['Real-time Detection', 'Multi-Camera', 'Analytics', 'Secure'].map((f) => (
              <span key={f} className="px-3 py-1 bg-white/10 text-primary-100 text-xs font-medium rounded-full border border-white/20">
                {f}
              </span>
            ))}
          </div>
        </div>

        <p className="relative text-primary-300 text-xs">© 2025 Smart Attendance System</p>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
              <Scan className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">Smart Attendance</span>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-8">
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
              <p className="text-slate-500 text-sm mt-1">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Input
                label="Email address"
                type="email"
                placeholder="admin@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={Mail}
                error={errors.email}
                autoComplete="email"
                required
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={Lock}
                  error={errors.password}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-[30px] text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Button
                type="submit"
                variant="default"
                size="lg"
                loading={loading}
                className="w-full mt-2"
              >
                Sign In
              </Button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-6">
              Secure access — Administrators only
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
