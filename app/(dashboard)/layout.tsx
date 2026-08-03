import { Navigation } from '@/components/layout/navigation';
import { InactivityLogout } from '@/components/auth/inactivity-logout';
export default function DashboardLayout({ children }: { children: React.ReactNode }) { return <><InactivityLogout /><Navigation />{children}</>; }
