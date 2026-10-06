export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page">
      <main id="main-content">{children}</main>
    </div>
  )
}
