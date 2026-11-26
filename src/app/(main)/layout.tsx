import AppShell from "@/components/layout/AppShell";
import Footer from "@/components/layout/Footer";
import BanChecker from "@/components/layouts/BanChecker";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <BanChecker />
      {children}
      <Footer />
    </AppShell>
  );
}
