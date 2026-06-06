import { PlasmaBackground } from '@/components/ui/PlasmaBackground'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlasmaBackground>
      <main>
        {children}
      </main>
    </PlasmaBackground>
  )
}
