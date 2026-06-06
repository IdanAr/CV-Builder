import { PlasmaBackground } from '@/components/ui/PlasmaBackground'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlasmaBackground>
      <main className="mx-auto max-w-4xl px-4 py-8">
        {children}
      </main>
    </PlasmaBackground>
  )
}
