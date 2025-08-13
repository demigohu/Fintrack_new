import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TrendingUp, Shield, ArrowRight, BarChart3, Wallet } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-cyber-grid opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-heading font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent text-glow">
                Future of
              </span>
              <br />
              <span className="text-white">Crypto Trading</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Experience next-generation cryptocurrency trading with advanced analytics, lightning-fast execution, and
              cyberpunk aesthetics.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 glow-purple hover:animate-pulse-glow text-lg px-8 py-4"
                >
                  Start Trading
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/trade">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 hover:glow-purple text-lg px-8 py-4 bg-transparent"
                >
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">Advanced Trading Features</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Powered by cutting-edge technology and designed for the future of finance
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 bg-slate-900/50 border-purple-500/20 hover:border-purple-500/40 hover:glow-purple transition-all group">
              <div className="p-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 glow-purple w-fit mb-6 group-hover:animate-pulse-glow">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-heading font-semibold text-white mb-4">Real-time Trading</h3>
              <p className="text-slate-400">
                Execute trades instantly with our advanced matching engine and real-time market data.
              </p>
            </Card>

            <Card className="p-8 bg-slate-900/50 border-cyan-500/20 hover:border-cyan-500/40 hover:glow-cyan transition-all group">
              <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-500 glow-cyan w-fit mb-6 group-hover:animate-pulse-glow">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-heading font-semibold text-white mb-4">Advanced Analytics</h3>
              <p className="text-slate-400">
                Comprehensive portfolio tracking with AI-powered insights and predictive analytics.
              </p>
            </Card>

            <Card className="p-8 bg-slate-900/50 border-pink-500/20 hover:border-pink-500/40 hover:glow-pink transition-all group">
              <div className="p-3 rounded-lg bg-gradient-to-r from-pink-600 to-purple-500 glow-pink w-fit mb-6 group-hover:animate-pulse-glow">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-heading font-semibold text-white mb-4">Bank-grade Security</h3>
              <p className="text-slate-400">
                Multi-layer security with cold storage, 2FA, and advanced encryption protocols.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="p-12 rounded-2xl bg-gradient-to-r from-purple-900/20 to-cyan-900/20 border border-purple-500/20 glow-purple">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-6">Ready to Enter the Future?</h2>
            <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of traders already using CyberTrade to maximize their crypto potential.
            </p>
            <Link href="/login">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 glow-purple hover:animate-pulse-glow text-lg px-8 py-4"
              >
                <Wallet className="mr-2 h-5 w-5" />
                Get Started Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
