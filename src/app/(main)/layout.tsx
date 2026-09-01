import Navbar from "@/components/layout/Navbar";
import BanChecker from "@/components/layouts/BanChecker";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <BanChecker />
      <main>{children}</main>
    </>
  );
}