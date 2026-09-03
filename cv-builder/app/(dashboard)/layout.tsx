import { PlasmaBackground } from '@/components/ui/PlasmaBackground'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlasmaBackground>
      <main id="main-content">
        {children}
      </main>
    </PlasmaBackground>
  )
}
